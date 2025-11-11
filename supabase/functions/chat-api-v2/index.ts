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
  calculateToneLevel,
  detectAndUpdateGender
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
 * Detect conversation type from recent messages
 * Returns 'group' if more than 2 unique senders (bot owner + 2+ others), otherwise 'one_on_one'
 */
function detectConversationType(
  recentMessages: Array<{ sender: 'user' | 'girl'; senderId?: string; text: string; timestamp: number }> | undefined,
  userId: string
): 'one_on_one' | 'group' {
  if (!recentMessages || recentMessages.length === 0) {
    return 'one_on_one'; // Default to one-on-one if no messages
  }

  // Extract unique sender IDs (excluding bot owner)
  const uniqueSenders = new Set<string>();
  
  for (const msg of recentMessages) {
    // Use senderId if available, otherwise infer from sender enum
    if (msg.senderId && msg.senderId !== userId) {
      uniqueSenders.add(msg.senderId);
    } else if (msg.sender === 'girl') {
      // For backward compatibility, 'girl' sender indicates a match
      // We'll need to extract the actual ID from context
      // For now, count it as one participant
      uniqueSenders.add('girl');
    }
  }

  // If we have more than 1 unique sender (excluding bot owner), it's a group
  return uniqueSenders.size > 1 ? 'group' : 'one_on_one';
}

/**
 * Extract unique participant IDs from recent messages
 * Returns array of platform IDs (excluding bot owner)
 */
function extractParticipants(
  recentMessages: Array<{ sender: 'user' | 'girl'; senderId?: string; text: string; timestamp: number }> | undefined,
  userId: string
): string[] {
  if (!recentMessages || recentMessages.length === 0) {
    return [];
  }

  const participants = new Set<string>();
  
  for (const msg of recentMessages) {
    if (msg.senderId && msg.senderId !== userId) {
      participants.add(msg.senderId);
    }
  }

  return Array.from(participants);
}

/**
 * Determine target user (who the bot owner is currently responding to)
 * Priority: 1) targetUserId from request, 2) girlId from request, 3) last message sender
 */
function determineTargetUser(
  req: WingmanRequest,
  recentMessages: Array<{ sender: 'user' | 'girl'; senderId?: string; text: string; timestamp: number }> | undefined,
  userId: string
): string | null {
  // Priority 1: Explicit targetUserId
  if (req.targetUserId) {
    return req.targetUserId;
  }

  // Priority 2: Backward compatibility with girlId
  if (req.girlId) {
    return req.girlId;
  }

  // Priority 3: Last person who sent a message (excluding bot owner)
  if (recentMessages && recentMessages.length > 0) {
    // Find last message from someone other than bot owner
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.senderId && msg.senderId !== userId) {
        return msg.senderId;
      }
    }
  }

  return null;
}

/**
 * Handle Wingman analysis request
 */
async function handleWingmanAnalysis(req: WingmanRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Detect conversation type and extract participants
    const conversationType = detectConversationType(req.recentMessages, req.userId);
    const participants = req.detectedParticipants || extractParticipants(req.recentMessages, req.userId);
    const targetUserId = determineTargetUser(req, req.recentMessages, req.userId);
    
    console.log(`[WingMAN] Conversation type: ${conversationType}, Participants: ${participants.length}, Target: ${targetUserId}`);
    
    // Determine target user ID (use provided or detected)
    const finalTargetUserId = targetUserId || req.girlId || req.targetUserId;
    if (!finalTargetUserId) {
      throw new Error('No target user ID available. Provide girlId, targetUserId, or recentMessages with senderId.');
    }
    
    // Get or create target user
    const targetUser = await getOrCreateUser(
      finalTargetUserId,
      req.girlName || 'Match',
      'match',
      { first_seen: new Date().toISOString() }
    );
    
    // Get or create all participant users for group chats
    const participantUsers = await Promise.all(
      participants.map(async (participantId) => {
        if (participantId === req.userId) return null; // Skip bot owner
        try {
          return await getOrCreateUser(participantId, 'Match', 'match', {});
        } catch (error) {
          console.warn(`Failed to get/create participant ${participantId}:`, error);
          return null;
        }
      })
    );
    const validParticipants = participantUsers.filter(u => u !== null);
    
    // Get conversation with room path
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, bot_user_id, match_user_id, conversation_status, room_path, conversation_type, target_user_id, active_participants')
      .eq('id', req.conversationId)
      .single();
    
    if (convError || !conversation) {
      throw new Error(`Conversation not found: ${req.conversationId}`);
    }
    
    // Update conversation with match_user_id and group info if needed
    const participantIds = validParticipants.map(u => u!.id);
    if (!conversation.match_user_id || conversation.conversation_type !== conversationType) {
      await updateConversationWithMatch(
        req.conversationId,
        targetUser.id,
        conversationType,
        conversationType === 'group' ? targetUser.id : null,
        conversationType === 'group' ? participantIds : []
      );
    }
    
    // Fetch user profile
    const userProfile = await fetchUserProfile(req.userId, 'bot_owner');
    
    // Detect and update gender for target user and participants
    if (req.recentMessages && req.recentMessages.length > 0) {
      await detectAndUpdateGender(finalTargetUserId, req.recentMessages, 'match');
      for (const participant of validParticipants) {
        if (participant!.platform_id !== finalTargetUserId) {
          await detectAndUpdateGender(participant!.platform_id, req.recentMessages, 'match');
        }
      }
    }
    
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
    // For group chats, fetch summaries for all participants; for one-on-one, just target user
    const participantPlatformIds = conversationType === 'group' 
      ? participants.filter(id => id !== req.userId)
      : [finalTargetUserId];
    
    let userRoomSummaries: any[] = [];
    let userAndBotRoomSummaries: any[] = [];
    let userAndBotGlobalSummaries: any[] = [];
    let toneLevel = 'very_shy';
    let closenessScore: number | null = null;
    let interactionCount: number | null = null;
    
    if (bot && roomId && participantPlatformIds.length > 0) {
      const [roomSummaries, botRoomSummaries, globalSummaries] = await Promise.all([
        fetchUserRoomSummaries(bot.id, roomId, participantPlatformIds),
        fetchUserAndBotRoomSummaries(bot.id, roomId, participantPlatformIds),
        fetchUserAndBotGlobalSummaries(bot.id, participantPlatformIds)
      ]);
      
      userRoomSummaries = roomSummaries;
      userAndBotRoomSummaries = botRoomSummaries;
      userAndBotGlobalSummaries = globalSummaries;
      
      // Calculate tone level from relationship summary for target user
      const targetSummary = botRoomSummaries.find(s => s.user_platform_id === finalTargetUserId);
      if (targetSummary) {
        closenessScore = targetSummary.closeness_score ?? null;
        interactionCount = targetSummary.interaction_count ?? null;
        toneLevel = calculateToneLevel(closenessScore, interactionCount);
      }
    }
    
    // Store messages if provided
    if (req.recentMessages && req.recentMessages.length > 0) {
      await storeMessages(
        req.conversationId,
        req.recentMessages,
        req.userId,
        finalTargetUserId
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
      
      // For group chats, include relationships with all participants
      if (conversationType === 'group' && userAndBotRoomSummaries.length > 0) {
        const relationships = userAndBotRoomSummaries.map((rel: any) => {
          const relText = typeof rel.relationship_summary === 'string'
            ? rel.relationship_summary
            : rel.relationship_summary?.relationshipSummary || 'just met';
          return `${rel.user_display_name || rel.user_platform_id}: ${relText}`;
        }).join(' | ');
        parts.push(`Relationships: ${relationships}`);
      } else if (userAndBotRoomSummaries.length > 0) {
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
    
    // Add group chat context if applicable
    let groupContext = '';
    if (conversationType === 'group') {
      const participantNames = validParticipants.map(u => u!.display_name || u!.platform_id).join(', ');
      groupContext = `\nCONVERSATION TYPE: GROUP CHAT\nACTIVE PARTICIPANTS: ${participantNames}\nTARGET USER: ${targetUser.display_name || finalTargetUserId} (you're responding to this person)\n`;
    }

    // Get user ID for persona and facts lookup
    const { data: botOwner } = await supabase
      .from('users')
      .select('id, current_persona_id')
      .eq('platform_id', req.userId)
      .eq('user_type', 'bot_owner')
      .single();

    // Load person facts for target user (before building dynamic content)
    let personFactsText = '';
    if (botOwner) {
      const { data: facts } = await supabase
        .from('person_facts')
        .select('fact_text')
        .eq('bot_user_id', botOwner.id)
        .eq('match_user_id', targetUser.id)
        .order('confidence', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (facts && facts.length > 0) {
        personFactsText = `\n\nPERSON FACTS ABOUT ${targetUser.display_name || finalTargetUserId}:\n${facts.map(f => `• ${f.fact_text}`).join('\n')}`;
      }
    }
    
    // Load persona from Supabase (or fallback to prompts.yaml)
    let systemPrompt = '';
    let promptVersion = '1.0.0';

    if (botOwner?.current_persona_id) {
      const { data: persona } = await supabase
        .from('bot_personas')
        .select('persona_prompt, persona_version')
        .eq('id', botOwner.current_persona_id)
        .single();
      
      if (persona) {
        systemPrompt = persona.persona_prompt;
        promptVersion = `persona-v${persona.persona_version}`;
        console.log('[WingMAN] Using persona from Supabase:', promptVersion);
      }
    }

    // Fallback to prompts.yaml if no persona in DB
    if (!systemPrompt) {
      const promptConfig = await promptLoader.loadPrompt();
      systemPrompt = promptConfig.content;
      promptVersion = promptConfig.version;
      console.log('[WingMAN] Using prompt from YAML:', promptVersion);
    }

    // Load profile if specified
    let profilePrompt = '';
    if (req.profileId && req.profileId !== 'auto') {
      const { data: profile } = await supabase
        .from('wingman_profiles')
        .select('strategy_prompt')
        .eq('id', req.profileId)
        .single();
      
      if (profile?.strategy_prompt) {
        profilePrompt = profile.strategy_prompt;
        console.log('[WingMAN] Using profile strategy');
      }
    } else if (req.autoDetectProfile) {
      // Auto-detect profile using ML
      try {
        const detectRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/wingman-profiles/auto-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botUserId: req.userId,
            matchProfile: targetUser.profile_data,
            conversationContext: relationshipContext,
            recentMessages: req.recentMessages
          })
        });

        if (detectRes.ok) {
          const detectResult = await detectRes.json();
          if (detectResult.profileId) {
            const { data: profile } = await supabase
              .from('wingman_profiles')
              .select('strategy_prompt')
              .eq('id', detectResult.profileId)
              .single();
            
            if (profile?.strategy_prompt) {
              profilePrompt = profile.strategy_prompt;
              console.log('[WingMAN] Auto-detected profile:', detectResult.profileName);
            }
          }
        }
      } catch (e) {
        console.warn('[WingMAN] Profile auto-detection failed:', e);
      }
    }

    // Merge profile prompt with system prompt
    if (profilePrompt) {
      systemPrompt = `${systemPrompt}\n\nPROFILE STRATEGY:\n${profilePrompt}`;
    }

    const recentMessagesText = req.recentMessages && req.recentMessages.length > 0
      ? formatRecentMessages(req.recentMessages, conversationType === 'group', req.userId)
      : 'No recent messages.';
    
    const dynamicContent = `RELATIONSHIP CONTEXT: ${relationshipContext}\n\n${toneContext}${groupContext}${personFactsText}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRECENT MESSAGES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${recentMessagesText}`;
    
    // Format user/target info for cache
    const userInfo = `Name: ${userProfile.display_name}\nProfile: ${JSON.stringify(userProfile.profile_data, null, 2)}`;
    const targetInfo = `Name: ${targetUser.display_name}\nProfile: ${JSON.stringify(targetUser.profile_data, null, 2)}`;
    
    // Create cache with system prompt + profiles (keyed by user/target IDs)
    const cacheName = await getOrCreateCache(
      systemPrompt,
      userInfo,
      targetInfo,
      req.userId,
      finalTargetUserId
    );
    
    // Generate suggestions with caching
    // Cache contains system instruction + user/target profiles
    // We only send conversation (dynamic content) when using cache
    const { text, responseTime, cachedTokens } = await generateWithCache(
      cacheName,
      systemPrompt,
      userInfo,
      targetInfo,
      dynamicContent
    );
    
    // Parse JSON response
    let response: WingmanResponse;
    try {
      // Extract JSON from text (handle markdown code blocks, plain JSON, etc.)
      let cleanedText = text.trim();
      
      // Remove markdown code blocks
      cleanedText = cleanedText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON object if there's extra text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // Try parsing first - if it works, great!
      let parsed: any;
      try {
        parsed = JSON.parse(cleanedText);
      } catch (firstError) {
        // If first parse fails, try to fix common issues
        console.log('[WingMAN] First parse failed, attempting to fix JSON...');
        
        // Fix unescaped newlines, tabs, carriage returns, and QUOTES in string values
        // Strategy: Find all string values (between quotes) and escape problematic chars
        let fixedText = '';
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < cleanedText.length; i++) {
          const char = cleanedText[i];
          const prevChar = i > 0 ? cleanedText[i - 1] : '';
          
          // Handle escape sequences
          if (escapeNext) {
            fixedText += char;
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            fixedText += char;
            continue;
          }
          
          // Track string boundaries
          if (char === '"' && prevChar !== '\\') {
            inString = !inString;
            fixedText += char;
            continue;
          }
          
          // Inside a string, escape problematic characters
          if (inString) {
            if (char === '\n') {
              fixedText += '\\n';
            } else if (char === '\r') {
              fixedText += '\\r';
            } else if (char === '\t') {
              fixedText += '\\t';
            } else if (char === '\b') {
              fixedText += '\\b';
            } else if (char === '\f') {
              fixedText += '\\f';
            } else if (char === '"') {
              // Unescaped quote inside string - escape it
              fixedText += '\\"';
            } else {
              fixedText += char;
            }
          } else {
            fixedText += char;
          }
        }
        
        // Remove trailing commas before } or ]
        fixedText = fixedText.replace(/,(\s*[}\]])/g, '$1');
        
        // Try parsing the fixed text
        try {
          parsed = JSON.parse(fixedText);
          console.log('[WingMAN] Successfully fixed and parsed JSON');
        } catch (secondError) {
          // If still failing, try one more aggressive fix: replace problematic chars outside strings
          // This time, be smarter about it - only replace outside of string contexts
          let aggressiveFix = '';
          let inStr = false;
          let escNext = false;
          
          for (let i = 0; i < fixedText.length; i++) {
            const c = fixedText[i];
            const prev = i > 0 ? fixedText[i - 1] : '';
            
            if (escNext) {
              aggressiveFix += c;
              escNext = false;
              continue;
            }
            
            if (c === '\\') {
              escNext = true;
              aggressiveFix += c;
              continue;
            }
            
            if (c === '"' && prev !== '\\') {
              inStr = !inStr;
              aggressiveFix += c;
              continue;
            }
            
            if (!inStr && (c === '\n' || c === '\r' || c === '\t')) {
              aggressiveFix += ' '; // Replace with space outside strings
            } else {
              aggressiveFix += c;
            }
          }
          
          // Try one more fix: handle unescaped quotes that might break JSON structure
          // Look for patterns like: "text"text" and fix them
          let quoteFix = aggressiveFix;
          let quoteFixAttempts = 0;
          while (quoteFixAttempts < 3) {
            try {
              parsed = JSON.parse(quoteFix);
              console.log('[WingMAN] Successfully parsed after quote fix');
              break;
            } catch (quoteError: any) {
              const errorMsg = quoteError.message || '';
              const errorPos = errorMsg.match(/position (\d+)/)?.[1];
              if (errorPos) {
                const pos = parseInt(errorPos);
                // Try to fix common issues at the error position
                if (pos < quoteFix.length) {
                  const charAtPos = quoteFix[pos];
                  // If it's a quote that shouldn't be there, escape it or remove it
                  if (charAtPos === '"' && pos > 0 && quoteFix[pos - 1] !== '\\' && quoteFix[pos - 1] !== ':') {
                    // Might be an unescaped quote - try escaping it
                    quoteFix = quoteFix.substring(0, pos) + '\\"' + quoteFix.substring(pos + 1);
                    quoteFixAttempts++;
                    continue;
                  }
                }
              }
              // If we can't fix it, break and throw
              break;
            }
          }
          
          // If still not parsed, try one final approach: extract just the JSON structure
          if (!parsed) {
            try {
              // Try to find and extract a valid JSON object by being more aggressive
              const jsonObjMatch = quoteFix.match(/\{\s*"analysis"\s*:\s*\{[^}]*\}\s*,\s*"suggestion"\s*:\s*\{[^}]*\}\s*,\s*"wingman_tip"\s*:\s*"[^"]*"\s*\}/);
              if (jsonObjMatch) {
                parsed = JSON.parse(jsonObjMatch[0]);
                console.log('[WingMAN] Successfully parsed using regex extraction');
              } else {
                throw new Error('Could not extract valid JSON structure');
              }
            } catch (finalError) {
              // Last resort: log the problematic section for debugging
              const errorMsg = (finalError as any).message || '';
              const errorPos = errorMsg.match(/position (\d+)/)?.[1];
              if (errorPos) {
                const pos = parseInt(errorPos);
                const start = Math.max(0, pos - 150);
                const end = Math.min(quoteFix.length, pos + 150);
                console.error('[WingMAN] JSON error at position', pos);
                console.error('[WingMAN] Context around error:', quoteFix.substring(start, end));
                console.error('[WingMAN] Character at error position:', quoteFix[pos] || 'EOF');
                console.error('[WingMAN] Full text length:', quoteFix.length);
              }
              console.error('[WingMAN] Original text (first 1000 chars):', text.substring(0, 1000));
              console.error('[WingMAN] Fixed text (first 1000 chars):', fixedText.substring(0, 1000));
              console.error('[WingMAN] Aggressive fix (first 1000 chars):', aggressiveFix.substring(0, 1000));
              console.error('[WingMAN] Quote fix (first 1000 chars):', quoteFix.substring(0, 1000));
              throw finalError;
            }
          }
        }
      }
      
      // Log the parsed response for debugging
      console.log('[WingMAN] Parsed LLM response:', JSON.stringify(parsed, null, 2));
      
      // Check if suggestion is missing or if it's an array (old format)
      if (!parsed.suggestion) {
        // Try to extract from suggestions array (backward compatibility)
        if (parsed.suggestions && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          console.warn('[WingMAN] Found suggestions array, using first item');
          parsed.suggestion = parsed.suggestions[0];
        } else {
          // Create a default suggestion if missing
          console.warn('[WingMAN] Missing suggestion field, creating default');
          parsed.suggestion = {
            type: 'Curious/Engaging',
            text: 'Hey, how are you?',
            rationale: 'A simple, friendly opener to start the conversation.'
          };
        }
      }
      
      // Monitor schema compliance (trust Gemini schema enforcement, but log violations)
      if (parsed.suggestion?.rationale) {
        const wordCount = parsed.suggestion.rationale.trim().split(/\s+/).length;
        const charCount = parsed.suggestion.rationale.length;
        if (wordCount > 50 || charCount > 240) {
          console.warn('[WingMAN] Rationale exceeded limits:', { wordCount, charCount });
          // Optional: Log to analytics for monitoring schema compliance
        }
      }
      
      // Add group chat metadata to parsed response
      parsed.conversationType = conversationType;
      parsed.detectedParticipants = participants;
      parsed.targetUser = {
        platformId: finalTargetUserId,
        displayName: targetUser.display_name,
        gender: targetUser.profile_data?.gender || 'unknown'
      };
      
      // Ensure analysis has required fields and group dynamics if applicable
      if (!parsed.analysis) {
        parsed.analysis = {};
      }
      if (conversationType === 'group' && !parsed.analysis.group_dynamics) {
        parsed.analysis.group_dynamics = `Group chat with ${participants.length} participants. Focus on responding to ${targetUser.display_name || finalTargetUserId}.`;
      }
      // Use gender-neutral field for group chats
      if (conversationType === 'group' && parsed.analysis.her_last_message_feeling && !parsed.analysis.their_last_message_feeling) {
        parsed.analysis.their_last_message_feeling = parsed.analysis.her_last_message_feeling;
      }
      
      // Validate schema
      response = WingmanResponseSchema.parse(parsed);
    } catch (parseError: any) {
      console.error('[WingMAN] Failed to parse response');
      console.error('[WingMAN] Raw text (first 1000 chars):', text.substring(0, 1000));
      console.error('[WingMAN] Parse error:', parseError);
      
      // If it's a Zod validation error, provide more details
      if (parseError.issues) {
        const errorDetails = parseError.issues.map((issue: any) => ({
          path: issue.path.join('.'),
          expected: issue.expected,
          received: issue.received,
          message: issue.message
        }));
        console.error('[WingMAN] Validation errors:', JSON.stringify(errorDetails, null, 2));
        throw new Error(`Invalid response format: ${JSON.stringify(errorDetails, null, 2)}`);
      }
      
      throw new Error(`Invalid response format: ${parseError.message}`);
    }
    
    // Store suggestion in database with prompt_version and tone_level for A/B testing
    const suggestionId = await storeBotSuggestion(
      req.conversationId,
      {
        user_profile: userProfile.profile_data,
        target_profile: targetUser.profile_data,
        conversation_type: conversationType,
        participants: participants,
        prompt_version: promptVersion,
        prompt_source: 'supabase_persona',
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

    // Add suggestion ID to response for feedback tracking
    if (suggestionId) {
      (response as any).suggestionId = suggestionId;
    }
    
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

