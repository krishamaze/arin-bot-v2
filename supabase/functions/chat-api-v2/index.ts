// Wingman Dating Chat Helper - Edge Function v2
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabase } from '../_shared/supabaseClient.ts';
import { 
  InitRequestSchema, 
  WingmanRequestSchema, 
  WingmanResponseSchema,
  type InitRequest,
  type WingmanRequest,
  type WingmanResponse
} from '../_shared/schemas.ts';
import { PromptLoader } from './services/promptLoader.ts';
import {
  getOrCreateUser,
  getOrCreateConversation,
  updateConversationWithMatch,
  fetchUserProfile,
  storeMessages,
  formatRecentMessages,
  storeBotSuggestion,
  fetchUserRoomSummaries,
  fetchUserAndBotRoomSummaries,
  fetchUserAndBotGlobalSummaries,
  calculateToneLevel
} from '../_shared/utils.ts';
import { getOrCreateCache, generateWithCache } from '../_shared/geminiClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
}

// Initialize prompt loader
const promptLoader = new PromptLoader();

/**
 * CORS headers helper
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

/**
 * Handle initialization request
 */
async function handleInit(req: InitRequest): Promise<Response> {
  try {
    // Get or create bot_owner user
    const user = await getOrCreateUser(
      req.platformId,
      req.username,
      'bot_owner',
      { initialized_at: new Date().toISOString() }
    );
    
    // Create conversation without match (match_user_id is null)
    const conversation = await getOrCreateConversation(
      user.id,
      req.roomPath,
      null  // match_user_id is null initially
    );
    
    return new Response(JSON.stringify({
      conversationId: conversation.id,
      userId: user.platform_id,
      status: 'initialized'
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Init error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Initialization failed'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Handle Wingman analysis request
 */
async function handleWingmanAnalysis(req: WingmanRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Get or create girl user
    const girlUser = await getOrCreateUser(
      req.girlId,
      req.girlName || 'Match',
      'match',
      { first_seen: new Date().toISOString() }
    );
    
    // Get conversation with room path
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, bot_user_id, match_user_id, conversation_status, room_path')
      .eq('id', req.conversationId)
      .single();
    
    if (convError || !conversation) {
      throw new Error(`Conversation not found: ${req.conversationId}`);
    }
    
    // Update conversation with match_user_id if not set
    if (!conversation.match_user_id) {
      await updateConversationWithMatch(req.conversationId, girlUser.id);
    }
    
    // Fetch user profile
    const userProfile = await fetchUserProfile(req.userId, 'bot_owner');
    
    // Get bot_id and room_id for fetching summaries
    // First get bot by platform_id
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id')
      .eq('platform_id', req.userId)
      .single();
    
    if (botError || !bot) {
      console.warn('Bot not found, skipping summary fetch');
    }
    
    // Get room by room_path
    let roomId: string | null = null;
    if (conversation.room_path) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_path', conversation.room_path)
        .single();
      
      if (!roomError && room) {
        roomId = room.id;
      }
    }
    
    // Fetch user summaries if bot and room are available
    let userRoomSummaries: any[] = [];
    let userAndBotRoomSummaries: any[] = [];
    let userAndBotGlobalSummaries: any[] = [];
    let toneLevel = 'very_shy';
    let closenessScore: number | null = null;
    let interactionCount: number | null = null;
    
    if (bot && roomId) {
      const [roomSummaries, botRoomSummaries, globalSummaries] = await Promise.all([
        fetchUserRoomSummaries(bot.id, roomId, [req.girlId]),
        fetchUserAndBotRoomSummaries(bot.id, roomId, [req.girlId]),
        fetchUserAndBotGlobalSummaries(bot.id, [req.girlId])
      ]);
      
      userRoomSummaries = roomSummaries;
      userAndBotRoomSummaries = botRoomSummaries;
      userAndBotGlobalSummaries = globalSummaries;
      
      // Calculate tone level from relationship summary
      if (botRoomSummaries.length > 0) {
        const relationship = botRoomSummaries[0];
        closenessScore = relationship.closeness_score ?? null;
        interactionCount = relationship.interaction_count ?? null;
        toneLevel = calculateToneLevel(closenessScore, interactionCount);
      }
    }
    
    // Store messages if provided
    if (req.recentMessages && req.recentMessages.length > 0) {
      await storeMessages(
        req.conversationId,
        req.recentMessages,
        req.userId,
        req.girlId
      );
    }
    
    // Format relationship context from summaries
    let relationshipContext = '';
    if (userRoomSummaries.length > 0 || userAndBotRoomSummaries.length > 0 || userAndBotGlobalSummaries.length > 0) {
      const parts: string[] = [];
      
      if (userRoomSummaries.length > 0) {
        const summary = typeof userRoomSummaries[0].summary === 'string' 
          ? userRoomSummaries[0].summary 
          : userRoomSummaries[0].summary?.summary || 'new here';
        parts.push(`Room: ${summary}`);
      }
      
      if (userAndBotRoomSummaries.length > 0) {
        const rel = typeof userAndBotRoomSummaries[0].relationship_summary === 'string'
          ? userAndBotRoomSummaries[0].relationship_summary
          : userAndBotRoomSummaries[0].relationship_summary?.relationshipSummary || 'just met';
        parts.push(`Relationship: ${rel}`);
      }
      
      if (userAndBotGlobalSummaries.length > 0) {
        const global = typeof userAndBotGlobalSummaries[0].global_summary === 'string'
          ? userAndBotGlobalSummaries[0].global_summary
          : userAndBotGlobalSummaries[0].global_summary?.globalRelationshipSummary || 'minimal history';
        parts.push(`History: ${global}`);
      }
      
      relationshipContext = parts.join(' | ');
    } else {
      relationshipContext = 'No prior history - first interaction';
    }
    
    // Build dynamic context with relationship info, tone level, and recent messages
    const toneContext = `CURRENT RELATIONSHIP: ${toneLevel} (closeness: ${closenessScore ?? 0}/10, interactions: ${interactionCount ?? 0})`;
    const recentMessagesText = req.recentMessages && req.recentMessages.length > 0
      ? formatRecentMessages(req.recentMessages)
      : 'No recent messages.';
    
    const dynamicContent = `RELATIONSHIP CONTEXT: ${relationshipContext}\n\n${toneContext}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRECENT MESSAGES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${recentMessagesText}`;
    
    // Load prompt (from YAML, DB, or fallback)
    const promptConfig = await promptLoader.loadPrompt();
    const systemPrompt = promptConfig.content;
    const promptVersion = promptConfig.version;
    
    // Format user/girl info for cache
    const userInfo = `Name: ${userProfile.display_name}\nProfile: ${JSON.stringify(userProfile.profile_data, null, 2)}`;
    const girlInfo = `Name: ${girlUser.display_name}\nProfile: ${JSON.stringify(girlUser.profile_data, null, 2)}`;
    
    // Create cache with system prompt + profiles (keyed by user/girl IDs)
    const cacheName = await getOrCreateCache(
      systemPrompt,
      userInfo,
      girlInfo,
      req.userId,
      req.girlId
    );
    
    // Generate suggestions with caching
    // Cache contains system instruction + user/girl profiles
    // We only send conversation (dynamic content) when using cache
    const { text, responseTime, cachedTokens } = await generateWithCache(
      cacheName,
      systemPrompt,
      userInfo,
      girlInfo,
      dynamicContent
    );
    
    // Parse JSON response
    let response: WingmanResponse;
    try {
      // Clean up markdown formatting if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      response = WingmanResponseSchema.parse(parsed);
    } catch (parseError: any) {
      console.error('Failed to parse response:', parseError);
      throw new Error(`Invalid response format: ${parseError.message}`);
    }
    
    // Store suggestion in database with prompt_version and tone_level for A/B testing
    await storeBotSuggestion(
      req.conversationId,
      {
        user_profile: userProfile.profile_data,
        girl_profile: girlUser.profile_data,
        prompt_version: promptVersion,
        prompt_source: promptConfig.source,
        tone_level: toneLevel,
        closeness_score: closenessScore,
        interaction_count: interactionCount
      },
      response.analysis,
      [response.suggestion], // Store as array for backward compatibility with DB schema
      response.wingman_tip,
      responseTime,
      cachedTokens
    );
    
    console.log(`✅ Wingman analysis completed in ${responseTime}ms (cached tokens: ${cachedTokens})`);
    
    return new Response(JSON.stringify(response), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Wingman analysis error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Analysis failed',
      details: error.stack
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Main request handler
 */
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  
  // Handle GET requests
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      method: req.method,
      availableEndpoints: ['/init', '/']
    }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Allow': 'POST, OPTIONS',
        ...corsHeaders
      }
    });
  }
  
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    
    // Check content type for POST requests
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Invalid content type',
        message: 'Content-Type must be application/json'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Parse JSON body with error handling
    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON',
        details: parseError.message
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Route to appropriate handler
    if (path.endsWith('/init') && req.method === 'POST') {
      // Initialize endpoint
      const validated = InitRequestSchema.parse(body);
      return handleInit(validated);
    } else if (req.method === 'POST') {
      // Main analysis endpoint
      const validated = WingmanRequestSchema.parse(body);
      return handleWingmanAnalysis(validated);
    } else {
      return new Response(JSON.stringify({
        error: 'Method not allowed',
        message: 'Only POST method is supported'
      }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Allow': 'POST, OPTIONS',
          ...corsHeaders
        }
      });
    }
  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: error.errors
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    console.error('Request error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      details: error.stack
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

console.log('🤖 Wingman Dating Helper v2 - Edge Function Ready');

