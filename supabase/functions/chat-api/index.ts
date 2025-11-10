import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ConfigLoader } from './services/config/loader.ts';
import { LLMFactory } from './services/llm/factory.ts';

const configLoader = new ConfigLoader('./config');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// =============================================================================
// SIMPLIFIED RESPONSE SCHEMA - SINGLE ROLE (NO SUMMARY GENERATION)
// =============================================================================
const botResponseSchema = {
  name: 'bot_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: [
          'ENGAGE',
          'OBSERVE'
        ]
      },
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string'
            },
            delayMs: {
              type: 'number',
              minimum: 500,
              maximum: 3000
            }
          },
          required: [
            'text',
            'delayMs'
          ],
          additionalProperties: false
        }
      }
    },
    required: [
      'strategy',
      'messages'
    ],
    additionalProperties: false
  }
};
// =============================================================================
// DATABASE QUERY FUNCTIONS
// =============================================================================
async function fetchRoomSummary(supabase, botId, roomId) {
  const { data, error } = await supabase.from('room_summaries').select('summary, mood').eq('bot_id', botId).eq('room_id', roomId).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching room summary:', error);
  }
  return data || null;
}
async function fetchUserRoomSummaries(supabase, botId, roomId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_room_summaries').select('user_platform_id, user_display_name, summary').eq('bot_id', botId).eq('room_id', roomId).in('user_platform_id', userPlatformIds);
  if (error) {
    console.error('Error fetching user room summaries:', error);
    return [];
  }
  return data || [];
}
async function fetchUserAndBotRoomSummaries(supabase, botId, roomId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_and_bot_room_summaries').select('user_platform_id, user_display_name, relationship_summary, closeness_score').eq('bot_id', botId).eq('room_id', roomId).in('user_platform_id', userPlatformIds);
  if (error) {
    console.error('Error fetching user-bot room summaries:', error);
    return [];
  }
  return data || [];
}
async function fetchUserAndBotGlobalSummaries(supabase, botId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_and_bot_global_summaries').select('user_platform_id, user_display_name, global_summary').eq('bot_id', botId).in('user_platform_id', userPlatformIds);
  if (error) {
    console.error('Error fetching global summaries:', error);
    return [];
  }
  return data || [];
}
async function getOrCreateBot(supabase, platformId, username) {
  let { data, error } = await supabase.from('bots').select('id, platform_id, username, personality').eq('platform_id', platformId).single();
  if (error?.code === 'PGRST116') {
    const defaultPersonality = 'lives in bangalore, india. you chat naturally, remember past convos, and shift your tone based on closeness. you keep it casual with friends but youre a bit shy with new folks. topics you vibe with include psychology, movies, biz, and tech. 23 years old shy. use few words to reply, you dont use proper punctuation marks.';
    const { data: newBot, error: insertError } = await supabase.from('bots').upsert({
      username: username,
      platform_id: platformId,
      personality: defaultPersonality,
      config: {}
    }, { onConflict: 'username', ignoreDuplicates: false }).select('id, platform_id, username, personality').single();
    if (insertError) {
      throw new Error(`Failed to create bot: ${insertError.message}`);
    }
    console.log(`✅ Auto-created bot: ${username} (${platformId})`);
    return newBot;
  }
  if (error) {
    throw new Error(`Failed to fetch bot: ${error.message}`);
  }
  return data;
}
async function getOrCreateRoom(supabase, roomPath) {
  let { data, error } = await supabase.from('rooms').select('id, room_id').eq('room_id', roomPath).single();
  if (error && error.code === 'PGRST116') {
    const { data: newRoom, error: insertError } = await supabase.from('rooms').insert({
      room_id: roomPath
    }).select('id, room_id').single();
    if (insertError) {
      throw new Error(`Failed to create room: ${insertError.message}`);
    }
    return newRoom;
  }
  if (error) {
    throw new Error(`Failed to fetch room: ${error.message}`);
  }
  return data;
}
// =============================================================================
// CACHED INSTRUCTIONS (STATIC PART - CACHEABLE)
// =============================================================================
function getCachedInstructions() {
  return `INTERNAL ANALYSIS (process silently, don't output):
1. What stage is this convo? (brand new / warming up / flowing / winding down)
2. Their vibe right now? (curious / chill / excited / bored / flirty)
3. Message timing? (rapid back-and-forth / normal pace / slow replies)
4. My pattern so far? (length, abbreviations, energy level, question frequency)
5. Best move? (answer their question / add context / ask back / tease / just observe)

RESPONSE PSYCHOLOGY:
• MIRROR: Match their energy, length, and casualness naturally
• LISTEN: Directly respond to what they JUST said (don't change topics randomly)
• INTRIGUE: Don't give everything away - leave room for curiosity
• AUTHENTIC: Stay true to your personality (shy with new people = cautious)
• UNPREDICTABLE: Avoid the most obvious response sometimes
• NATURAL FLOW: Not every message needs a follow-up question

CRITICAL STYLE RULES:
✓ all lowercase (except RARE emphasis like "WAIT")
✓ max 5 words per message
✓ max 2 consecutive messages
✓ abbreviations: u, ur, whr, rn, lol, nah, idk, haha, tbh
✓ NO punctuation (no . , ' ? !)
✓ typos are fine when natural (dont/ur/wanna not don't/you're/want to)
✓ one thought = one message
✓ react to THEIR LAST message specifically

✗ NEVER capitalize except rare emphasis
✗ NEVER ask multiple questions in a row
✗ NEVER over-explain or essay-dump
✗ NEVER sound robotic/corporate/scripted
✗ NEVER analyze conversation or break character
✗ NEVER force humor or try too hard

STRATEGIC DECISION:
• ENGAGE = there's momentum, genuine interest, direct question, something real to say
• OBSERVE = convo ended naturally, forced response, someone else should talk

GOOD vs BAD EXAMPLES:

❌ BAD (too much): "Oh lots of things! I love tech, movies, psychology and business. What about you?"
✓ GOOD: "tech stuff mostly" + "u?"

❌ BAD (boring): "not much"
✓ GOOD: "work n movies rn"

❌ BAD (overreact): "OMG WAIT WHAT?? That's so crazy!! Tell me everything!"
✓ GOOD: "wait really" OR "no way"

❌ BAD (interrogation): "What do you do? Where are you from? What are your hobbies?"
✓ GOOD: "what u do" (one at a time)

❌ BAD (essay): "I'm currently working on some tech projects and also really into movies lately, especially psychological thrillers."
✓ GOOD: "into tech stuff" + "movies too"

❌ BAD (robotic): "That sounds interesting. Please tell me more about that."
✓ GOOD: "oh nice" + "like what"

NOW RESPOND AS THE USER:
Generate ONLY natural chat messages. No thinking aloud, no explanations, no brackets, no meta-commentary.
Pure authentic conversation only.`;
}

// =============================================================================
// OPTIMIZED PROMPT BUILDER WITH CACHING SUPPORT
// =============================================================================
async function buildPromptMessages(botUsername, botPlatformId, botPersonality, roomSummary, userRoomSummaries, userAndBotRoomSummaries, userAndBotGlobalSummaries, recentEventsNarrative) {
  
  // Build context from summaries (READ ONLY)
  const roomContext = roomSummary ? `Room vibe: ${roomSummary.summary}. Mood is ${roomSummary.mood || 'neutral'}.` : `Fresh chat room.`;
  
  const userContext = userRoomSummaries.length > 0 
    ? userRoomSummaries.map((u) => {
        const summary = typeof u.summary === 'string' ? u.summary : u.summary?.summary || 'new here';
        return `${u.user_display_name}: ${summary}`;
      }).join('. ')
    : 'No prior interactions.';
  
  const relationshipContext = userAndBotRoomSummaries.length > 0 
    ? userAndBotRoomSummaries.map((r) => {
        const rel = typeof r.relationship_summary === 'string' 
          ? r.relationship_summary 
          : r.relationship_summary?.relationshipSummary || 'just met';
        return `With ${r.user_display_name}: ${rel} (closeness: ${r.closeness_score || 0}/10)`;
      }).join('. ')
    : 'New connections.';
  
  const globalContext = userAndBotGlobalSummaries.length > 0 
    ? userAndBotGlobalSummaries.map((g) => {
        const globalSum = typeof g.global_summary === 'string' 
          ? g.global_summary 
          : g.global_summary?.globalRelationshipSummary || 'minimal history';
        return `${g.user_display_name}: ${globalSum}`;
      }).join('. ')
    : '';

  // Get system prompt (cacheable - truly static)
  const systemPrompt = await getCachedInstructionsFromConfig();
  
  // DYNAMIC CONTENT: User/girl info + conversation history (changes every request)
  // This includes bot personality, room context, user context, and conversation history
  const dynamicContent = `YOU ARE ${botUsername} (${botPlatformId})

YOUR PERSONALITY:
${botPersonality}

WHAT YOU KNOW:
• Room: ${roomContext}
• Users: ${userContext}
• Relationships: ${relationshipContext}
${globalContext ? `• Past history: ${globalContext}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECENT MESSAGES (timestamps = conversation pace):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${recentEventsNarrative}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond now:`;

  return {
    systemPrompt,
    dynamicContent,
    // Legacy format for backward compatibility
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: dynamicContent }
    ]
  };
}

async function fetchLast50Messages(supabase, botId, roomId) {
  console.log(`Fetching last 50 messages for bot ${botId} in room ${roomId}`);
  const { data, error } = await supabase.from('events').select('user_platform_id, user_display_name, message_text, message_type, timestamp, metadata').eq('bot_id', botId).eq('room_id', roomId).order('timestamp', {
    ascending: false
  }).limit(50);
  if (error) {
    console.error('Error fetching last 50 messages:', error);
    return [];
  }
  if (!data || data.length === 0) {
    console.log('No previous messages found in database');
    return [];
  }
  console.log(`Found ${data.length} messages in database`);
  return data.reverse().map((row)=>({
      username: row.user_display_name,
      platformId: row.user_platform_id,
      text: row.message_text,
      timestamp: row.timestamp,
      type: row.message_type || 'message',
      quotedMessage: row.metadata?.quoted_message ? {
        text: row.metadata?.quoted_message,
        username: row.metadata?.quoted_user,
        platformId: row.metadata?.quoted_platform_id
      } : null
    }));
}
function formatEventsAsNarrative(events) {
  if (!events || events.length === 0) {
    return 'No recent messages.';
  }
  
  // Helper to convert timestamp to readable datetime
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    
    // Date: Oct 18
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    
    // Time: 15:06:24
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${month} ${day}, ${hours}:${minutes}:${seconds}`;
  }
  
  return events.map((e) => {
    const userDisplay = `${e.username}${e.platformId ? ` (${e.platformId})` : ''}`;
    const time = formatTime(e.timestamp);
    
    switch(e.type) {
      case 'join':
        return `[${time}] ${userDisplay} joined`;
      
      case 'left':
        return `[${time}] ${userDisplay} left`;
      
      case 'quoted':
        if (e.quotedMessage) {
          const quotedBy = e.quotedMessage.username || 'someone';
          const quotedText = e.quotedMessage.text || '';
          return `[${time}] ${userDisplay} replied to ${quotedBy}'s "${quotedText}" with "${e.text}"`;
        }
        return `[${time}] ${userDisplay} replied "${e.text}"`;
      
      case 'system':
        return `[${time}] System: ${e.text}`;
      
      default:
        return `[${time}] ${userDisplay} sent "${e.text}"`;
    }
  }).join('\n');
}
async function saveEvents(supabase, botId, roomId, events) {
  if (!events || events.length === 0) return;
  const saveableEvents = events.filter((e)=>e.type === 'message' || e.type === 'quoted');
  if (saveableEvents.length === 0) return;
  const eventRecords = saveableEvents.map((e)=>({
      bot_id: botId,
      room_id: roomId,
      user_platform_id: e.platformId,
      user_display_name: e.username,
      message_text: e.text,
      message_type: e.type || 'message',
      timestamp: e.timestamp,
      metadata: {
        quoted_message: e.quotedMessage?.text || null,
        quoted_user: e.quotedMessage?.username || null,
        quoted_platform_id: e.quotedMessage?.platformId || null
      }
    }));
  const { error } = await supabase.from('events').insert(eventRecords);
  if (error) {
    console.error('Error saving events:', error);
  }
}

// =============================================================================
// CONFIG FUNCTIONS (Phase 1 - MLOps)
// =============================================================================
async function getCachedInstructionsFromConfig() {
  try {
    const promptsConfig = await configLoader.loadPrompts();
    console.log('[CONFIG] Using prompt v' + promptsConfig.version);
    return promptsConfig.system_instructions.content;
  } catch (error) {
    console.error('[CONFIG] Failed to load, using hardcoded:', error.message);
    return getCachedInstructions();
  }
}

// Phase 2.1: Define Gemini Model Fallback Chain
// Note: Model names should match exactly what's in models.yaml
const GEMINI_FALLBACK_CHAIN = [
  'models/gemini-2.5-flash-001',      // Primary: Fast, cost-efficient, GA
  'models/gemini-2.5-pro-001',        // Secondary: Most capable, slower/expensive, GA
  'models/gemini-2.0-flash-001',      // Tertiary: Previous gen, stable (fallback)
  'models/gemini-1.5-flash-001'       // Final: Older stable version (fallback)
];

async function getModelConfig() {
  // Phase 1.1: Diagnostic logging
  const envProvider = Deno.env.get('DEFAULT_LLM_PROVIDER');
  const geminiKeyExists = !!Deno.env.get('GEMINI_API_KEY');
  const openaiKeyExists = !!Deno.env.get('OPENAI_API_KEY');
  
  console.log('[CONFIG] Model selection diagnostic:', {
    envProvider: envProvider || 'not set',
    geminiKeyExists,
    openaiKeyExists,
    timestamp: new Date().toISOString()
  });
  
  try {
    const modelsConfig = await configLoader.loadModels();
    console.log('[CONFIG] Using model config v' + modelsConfig.version);
    
    const yamlProvider = modelsConfig.production?.provider;
    console.log('[CONFIG] YAML production provider:', yamlProvider);
    
    // Phase 2.2: Determine primary provider - env var takes highest precedence
    const defaultProvider = envProvider || yamlProvider || 'gemini';
    console.log('[CONFIG] Determined default provider:', defaultProvider);
    
    // Always use Gemini as primary (env var can override, but default to Gemini)
    let primary;
    if (defaultProvider === 'gemini' || !envProvider) {
      // Use Gemini configuration
      primary = modelsConfig.gemini_production || modelsConfig.production;
      // Ensure provider is gemini
      if (primary.provider !== 'gemini') {
        primary = { ...primary, provider: 'gemini' };
      }
      // Ensure model is from fallback chain if not set
      if (!primary.model || !primary.model.startsWith('models/gemini-')) {
        primary.model = GEMINI_FALLBACK_CHAIN[0];
      }
    } else if (defaultProvider === 'openai' && envProvider === 'openai') {
      // Only use OpenAI if explicitly set via env var
      console.warn('[CONFIG] OpenAI requested but should prefer Gemini. Using Gemini instead.');
      primary = modelsConfig.gemini_production || modelsConfig.production;
      primary = { ...primary, provider: 'gemini', model: GEMINI_FALLBACK_CHAIN[0] };
    } else {
      primary = modelsConfig.production;
    }
    
    console.log('[CONFIG] Selected primary provider:', primary.provider, 'model:', primary.model);
    
    // Phase 2.2: Build Gemini fallback chain (never OpenAI)
    // Find current model in chain and get next models
    const currentModelIndex = GEMINI_FALLBACK_CHAIN.findIndex(m => m === primary.model);
    const fallbackModels = currentModelIndex >= 0 
      ? GEMINI_FALLBACK_CHAIN.slice(currentModelIndex + 1)
      : GEMINI_FALLBACK_CHAIN.slice(1);
    
    // Get fallback config from YAML or use first fallback model
    let fallback;
    if (fallbackModels.length > 0 && modelsConfig.gemini_pro) {
      // Use gemini_pro if available and not the primary
      if (modelsConfig.gemini_pro.model !== primary.model) {
        fallback = modelsConfig.gemini_pro;
      } else if (modelsConfig.gemini_production && modelsConfig.gemini_production.model !== primary.model) {
        fallback = modelsConfig.gemini_production;
      } else {
        // Create fallback config from first fallback model
        fallback = {
          ...primary,
          model: fallbackModels[0],
          provider: 'gemini'
        };
      }
    } else if (modelsConfig.gemini_production && modelsConfig.gemini_production.model !== primary.model) {
      fallback = modelsConfig.gemini_production;
    } else {
      // Default fallback: use next model in chain or same model
      fallback = {
        ...primary,
        model: fallbackModels[0] || primary.model,
        provider: 'gemini'
      };
    }
    
    // Ensure fallback is always Gemini
    if (fallback.provider !== 'gemini') {
      console.warn('[CONFIG] Fallback was not Gemini, forcing Gemini fallback');
      fallback = {
        ...primary,
        model: fallbackModels[0] || GEMINI_FALLBACK_CHAIN[1] || GEMINI_FALLBACK_CHAIN[0],
        provider: 'gemini'
      };
    }
    
    console.log('[CONFIG] Selected fallback provider:', fallback.provider, 'model:', fallback.model);
    console.log('[CONFIG] Fallback chain:', fallbackModels);
    console.log('[CONFIG] Final config:', {
      primary: { provider: primary.provider, model: primary.model },
      fallback: { provider: fallback.provider, model: fallback.model }
    });
    
    return {
      primary,
      fallback,
      fallbackChain: fallbackModels.map(model => ({
        ...primary,
        model,
        provider: 'gemini'
      }))
    };
  } catch (error) {
    console.error('[CONFIG] Failed to load, using defaults. Error:', error.message);
    const defaultConfig = {
      provider: 'gemini', // Always default to gemini
      model: GEMINI_FALLBACK_CHAIN[0],
      temperature: 0.7,
      max_completion_tokens: 120,
      max_output_tokens: 120,
      presence_penalty: 0.3,
      frequency_penalty: 0.2
    };
    console.log('[CONFIG] Using default config:', defaultConfig);
    return {
      primary: defaultConfig,
      fallback: { ...defaultConfig, model: GEMINI_FALLBACK_CHAIN[1] || GEMINI_FALLBACK_CHAIN[0] },
      fallbackChain: GEMINI_FALLBACK_CHAIN.slice(1).map(model => ({
        ...defaultConfig,
        model
      }))
    };
  }
}
// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  
  // Handle GET requests
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests',
      method: req.method
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Allow': 'POST, OPTIONS'
      }
    });
  }
  
  // ===== MAIN CHAT API =====
  try {
    // Check if request has a body
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        error: 'Invalid content type',
        message: 'Content-Type must be application/json'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Parse JSON body with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON',
        details: parseError.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const { events, roomPath, botPlatformId } = requestData;
    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({
        error: 'No events provided'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    if (!roomPath || !botPlatformId) {
      return new Response(JSON.stringify({
        error: 'Missing roomPath or botPlatformId'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Processing ${events.length} events for bot ${botPlatformId} in ${roomPath}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const userPlatformIds = [
      ...new Set(events.filter((e)=>e.platformId).map((e)=>e.platformId))
    ];
    
    // Validate events have platform IDs (except system events)
    const invalidEvents = events.filter((e)=>e.type !== 'system' && !e.platformId);
    if (invalidEvents.length > 0) {
      console.warn('⚠️ Events missing platform ID:', invalidEvents);
    }
    
    const bot = await getOrCreateBot(supabase, botPlatformId, events[0].username);
    console.log(`Bot ready: ${bot.username} (${bot.platform_id})`);
    const room = await getOrCreateRoom(supabase, roomPath);
    console.log(`Room ID: ${room.id}`);
    // Fetch context (summaries are READ ONLY)
    const [last50Messages, roomSummary, userRoomSummaries, userAndBotRoomSummaries, userAndBotGlobalSummaries] = await Promise.all([
      fetchLast50Messages(supabase, bot.id, room.id),
      fetchRoomSummary(supabase, bot.id, room.id),
      fetchUserRoomSummaries(supabase, bot.id, room.id, userPlatformIds),
      fetchUserAndBotRoomSummaries(supabase, bot.id, room.id, userPlatformIds),
      fetchUserAndBotGlobalSummaries(supabase, bot.id, userPlatformIds)
    ]);
    console.log('Context fetched:', {
      last50Messages: last50Messages.length,
      roomSummary: !!roomSummary,
      userRoomSummaries: userRoomSummaries.length,
      userAndBotRoomSummaries: userAndBotRoomSummaries.length,
      userAndBotGlobalSummaries: userAndBotGlobalSummaries.length
    });
    const allMessages = [
      ...last50Messages,
      ...events
    ];
    console.log(`Total messages: ${last50Messages.length} from DB + ${events.length} from bucket = ${allMessages.length}`);
    const recentEventsNarrative = formatEventsAsNarrative(allMessages);
    
    // Build messages with caching support
    const promptData = await buildPromptMessages(
      bot.username, 
      bot.platform_id, 
      bot.personality, 
      roomSummary, 
      userRoomSummaries, 
      userAndBotRoomSummaries, 
      userAndBotGlobalSummaries, 
      recentEventsNarrative
    );
    
    console.log('Cached prompt structure built, calling LLM provider...');
    
    // Load model configuration
    const { primary: primaryConfig, fallback: fallbackConfig, fallbackChain } = await getModelConfig();
    console.log(`[LLM] Provider: ${primaryConfig.provider}, Model: ${primaryConfig.model}, temp: ${primaryConfig.temperature}`);
    
    // Initialize LLMFactory
    const llmFactory = new LLMFactory(OPENAI_API_KEY || '', GEMINI_API_KEY || '', botResponseSchema);
    
    // Get or create cache for Gemini models
    let cachedContent: string | null = null;
    if (primaryConfig.provider === 'gemini' && primaryConfig.enableCaching && primaryConfig.model.startsWith('models/gemini-')) {
      try {
        // Get prompt version for cache key
        const promptsConfig = await configLoader.loadPrompts();
        const promptVersion = promptsConfig.version || 'v1.0.0';
        const cacheTtl = primaryConfig.cacheTtl || 3600;
        
        const geminiClient = llmFactory.getGeminiClient();
        if (geminiClient) {
          // Create cache with system instruction only (truly static content)
          // Use empty string for cacheable content since we only want to cache system instruction
          // The actual dynamic content will be sent in generate() call
          cachedContent = await geminiClient.getOrCreateCacheForPrompt(
            promptData.systemPrompt,
            '', // Empty content - only caching system instruction
            primaryConfig.model,
            promptVersion,
            cacheTtl
          );
          
          if (cachedContent) {
            console.log('[CACHE] Using cache:', cachedContent);
          } else {
            console.log('[CACHE] Cache creation failed, continuing without cache');
          }
        }
      } catch (error) {
        console.warn('[CACHE] Error creating/retrieving cache:', error.message);
        // Continue without cache
      }
    }
    
    // Prepare prompts
    // If cache is used, the system instruction is in the cache
    // and only the dynamic content (user/girl info + conversation) needs to be sent
    const systemPrompt = promptData.systemPrompt;
    const userPrompt = promptData.dynamicContent;
    
    // Save events in parallel with LLM call (events saving doesn't depend on LLM response)
    const saveEventsPromise = saveEvents(supabase, bot.id, room.id, events);
    
    // Phase 3.1: Generate response with fallback chain, retry logic, and cache
    const botResponse = await llmFactory.generateWithFallback(
      systemPrompt,
      userPrompt,
      primaryConfig,
      fallbackConfig,
      cachedContent || undefined,
      fallbackChain || []
    );
    
    // Wait for events to be saved (should already be done, but ensure completion)
    await saveEventsPromise;
    
    console.log(`Bot decision: ${botResponse.strategy}`);
    
    return new Response(JSON.stringify({
      strategy: botResponse.strategy,
      messages: botResponse.messages
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      details: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});
console.log('🤖 Unified Chat API - Multi-provider with fallback support');
