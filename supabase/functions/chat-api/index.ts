import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts';
import { ConfigLoader } from './services/config/loader.ts';
import { LLMFactory } from './services/llm/factory.ts';
import type { LLMConfig } from './services/llm/interface.ts';

const CODE_VERSION = 'v1.0.0';
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
  const { data, error } = await supabase.from('room_summaries').select('*').eq('bot_id', botId).eq('room_id', roomId).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching room summary:', error);
  }
  return data || null;
}
async function fetchUserRoomSummaries(supabase, botId, roomId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_room_summaries').select('*').eq('bot_id', botId).eq('room_id', roomId).in('user_platform_id', userPlatformIds);
  if (error) {
    console.error('Error fetching user room summaries:', error);
    return [];
  }
  return data || [];
}
async function fetchUserAndBotRoomSummaries(supabase, botId, roomId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_and_bot_room_summaries').select('*').eq('bot_id', botId).eq('room_id', roomId).in('user_platform_id', userPlatformIds);
  if (error) {
    console.error('Error fetching user-bot room summaries:', error);
    return [];
  }
  return data || [];
}
async function fetchUserAndBotGlobalSummaries(supabase, botId, userPlatformIds) {
  if (userPlatformIds.length === 0) return [];
  const { data, error } = await supabase.from('user_and_bot_global_summaries').select('*').eq('bot_id', botId).in('user_platform_id', userPlatformIds);
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
    const { data: newBot, error: insertError } = await supabase.from('bots').insert({
      username: username,
      platform_id: platformId,
      personality: defaultPersonality,
      config: {}
    }).select('id, platform_id, username, personality').single();
    if (insertError) {
      throw new Error(`Failed to create bot: ${insertError.message}`);
    }
    console.log(`âœ… Auto-created bot: ${username} (${platformId})`);
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
â€¢ MIRROR: Match their energy, length, and casualness naturally
â€¢ LISTEN: Directly respond to what they JUST said (don't change topics randomly)
â€¢ INTRIGUE: Don't give everything away - leave room for curiosity
â€¢ AUTHENTIC: Stay true to your personality (shy with new people = cautious)
â€¢ UNPREDICTABLE: Avoid the most obvious response sometimes
â€¢ NATURAL FLOW: Not every message needs a follow-up question

CRITICAL STYLE RULES:
âœ“ all lowercase (except RARE emphasis like "WAIT")
âœ“ max 5 words per message
âœ“ max 2 consecutive messages
âœ“ abbreviations: u, ur, whr, rn, lol, nah, idk, haha, tbh
âœ“ NO punctuation (no . , ' ? !)
âœ“ typos are fine when natural (dont/ur/wanna not don't/you're/want to)
âœ“ one thought = one message
âœ“ react to THEIR LAST message specifically

âœ— NEVER capitalize except rare emphasis
âœ— NEVER ask multiple questions in a row
âœ— NEVER over-explain or essay-dump
âœ— NEVER sound robotic/corporate/scripted
âœ— NEVER analyze conversation or break character
âœ— NEVER force humor or try too hard

STRATEGIC DECISION:
â€¢ ENGAGE = there's momentum, genuine interest, direct question, something real to say
â€¢ OBSERVE = convo ended naturally, forced response, someone else should talk

GOOD vs BAD EXAMPLES:

âŒ BAD (too much): "Oh lots of things! I love tech, movies, psychology and business. What about you?"
âœ“ GOOD: "tech stuff mostly" + "u?"

âŒ BAD (boring): "not much"
âœ“ GOOD: "work n movies rn"

âŒ BAD (overreact): "OMG WAIT WHAT?? That's so crazy!! Tell me everything!"
âœ“ GOOD: "wait really" OR "no way"

âŒ BAD (interrogation): "What do you do? Where are you from? What are your hobbies?"
âœ“ GOOD: "what u do" (one at a time)

âŒ BAD (essay): "I'm currently working on some tech projects and also really into movies lately, especially psychological thrillers."
âœ“ GOOD: "into tech stuff" + "movies too"

âŒ BAD (robotic): "That sounds interesting. Please tell me more about that."
âœ“ GOOD: "oh nice" + "like what"

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

  // CACHEABLE SYSTEM MESSAGE (static instructions)
  const cachedSystemMessage = {
    role: 'system',
    content: await getCachedInstructionsFromConfig()
  };

  // DYNAMIC USER MESSAGE (changes every request - NOT cached)
  const dynamicUserMessage = {
    role: 'user',
    content: `YOU ARE ${botUsername} (${botPlatformId})

YOUR PERSONALITY:
${botPersonality}

WHAT YOU KNOW:
â€¢ Room: ${roomContext}
â€¢ Users: ${userContext}
â€¢ Relationships: ${relationshipContext}
${globalContext ? `â€¢ Past history: ${globalContext}` : ''}

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
RECENT MESSAGES (timestamps = conversation pace):
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
${recentEventsNarrative}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Respond now:`
  };

  return [cachedSystemMessage, dynamicUserMessage];
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
  return events.map((e)=>{
    const isSystemNotification = !e.platformId;
    const date = new Date(e.timestamp);
    const month = date.toLocaleString('en-US', {
      month: 'short'
    }).toLowerCase();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedTime = `${month} ${day}, ${hour12}:${minutes}${ampm}`;
    if (isSystemNotification) {
      return `System: ${e.text} at ${formattedTime}`;
    } else {
      const userDisplay = `${e.username}${e.platformId ? `(${e.platformId})` : ''}`;
      return `${userDisplay} sent "${e.text}" at ${formattedTime}`;
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

async function getModelConfig() {
  try {
    const modelsConfig = await configLoader.loadModels();
    console.log('[CONFIG] Using model config v' + modelsConfig.version);
    return modelsConfig.production;
  } catch (error) {
    console.error('[CONFIG] Failed to load, using defaults');
    return {
      provider: 'openai',
      model: 'gpt-4o-2024-08-06',
      temperature: 0.7,
      max_completion_tokens: 120,
      presence_penalty: 0.3,
      frequency_penalty: 0.2
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
  const url = new URL(req.url);
  // ===== CONFIG ENDPOINT (GET) =====
  if (req.method === 'GET' && url.pathname.endsWith('/config')) {
    try {
      const roomPath = url.searchParams.get('roomId');
      const platformId = url.searchParams.get('platformId');
      if (!platformId || !roomPath) {
        return new Response(JSON.stringify({
          error: 'Missing platformId or roomId'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await supabase.from('bot_configs').select('platform_id').eq('room_id', roomPath).eq('platform_id', platformId).single();
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (!data) {
        return new Response(JSON.stringify({
          message: 'No config found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return new Response(JSON.stringify({
        platformId: data.platform_id
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Config GET error:', error);
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  // ===== CONFIG SAVE (POST /config) =====
  if (req.method === 'POST' && url.pathname.endsWith('/config')) {
    try {
      const { roomId, platformId, username } = await req.json();
      if (!roomId || !platformId) {
        return new Response(JSON.stringify({
          error: 'Missing fields'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      if (username) {
        await getOrCreateBot(supabase, platformId, username);
      }
      const { error } = await supabase.from('bot_configs').upsert({
        room_id: roomId,
        platform_id: platformId
      }, {
        onConflict: 'room_id,platform_id'
      });
      if (error) throw error;
      return new Response(JSON.stringify({
        success: true
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Config POST error:', error);
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  // ===== MAIN CHAT API =====
  try {
    const { events, roomPath, botPlatformId } = await req.json();
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
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    const userPlatformIds = [
      ...new Set(events.filter((e)=>e.platformId).map((e)=>e.platformId))
    ];
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
    await saveEvents(supabase, bot.id, room.id, events);
    // Build messages with caching support
    const messages = await buildPromptMessages(
      bot.username, 
      bot.platform_id, 
      bot.personality, 
      roomSummary, 
      userRoomSummaries, 
      userAndBotRoomSummaries, 
      userAndBotGlobalSummaries, 
      recentEventsNarrative
    );
    
    console.log('Cached prompt structure built, calling OpenAI with caching...');
    
    // Load model configuration
    const modelConfig = await getModelConfig();
    console.log('[OPENAI] Model:', modelConfig.model, 'temp:', modelConfig.temperature);

    const completion = await openai.chat.completions.create({
      model: modelConfig.model,
      messages: messages,
      temperature: modelConfig.temperature,
      max_completion_tokens: modelConfig.max_completion_tokens,
      presence_penalty: modelConfig.presence_penalty,
      frequency_penalty: modelConfig.frequency_penalty,
      response_format: {
        type: 'json_schema',
        json_schema: botResponseSchema
      }
    });
    
    const botResponse = JSON.parse(completion.choices[0].message.content || '{}');
    console.log(`Bot decision: ${botResponse.strategy}`);
    
    // Log cache usage if available
    if (completion.usage) {
      console.log('Token usage:', {
        prompt_tokens: completion.usage.prompt_tokens,
        cached_tokens: completion.usage.prompt_tokens_details?.cached_tokens || 0,
        completion_tokens: completion.usage.completion_tokens
      });
    }
    
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
console.log('ðŸ¤– Cached Natural Conversation Bot v8.0 - Optimized with Prompt Caching');