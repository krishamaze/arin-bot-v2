import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
// =============================================================================
// 3. OPENAI RESPONSE SCHEMA (NEW - 4 SUMMARY TYPES)
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
      },
      messageAnalysis: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            username: {
              type: 'string'
            },
            platformId: {
              type: 'string'
            },
            intent: {
              type: 'string'
            },
            emotionalTone: {
              type: 'string'
            },
            topics: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          required: [
            'username',
            'platformId',
            'intent',
            'emotionalTone',
            'topics'
          ],
          additionalProperties: false
        }
      },
      updatedRoomSummary: {
        type: 'object',
        properties: {
          summary: {
            type: 'string'
          },
          mood: {
            type: 'string'
          },
          topics: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        },
        required: [
          'summary',
          'mood',
          'topics'
        ],
        additionalProperties: false
      },
      updatedUserRoomSummaries: {
        type: 'array',
        description: 'Must include every {platformId} from the events, even if the summary is unchanged.',
        items: {
          type: 'object',
          properties: {
            platformId: {
              type: 'string'
            },
            username: {
              type: 'string'
            },
            summary: {
              type: 'string'
            },
            activityLevel: {
              type: 'string'
            },
            topics: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          required: [
            'platformId',
            'username',
            'summary',
            'activityLevel',
            'topics'
          ],
          additionalProperties: false
        }
      },
      updatedUserAndBotRoomSummaries: {
        type: 'array',
        description: 'Must include every {platformId} from the events, even if the summary is unchanged.',
        items: {
          type: 'object',
          properties: {
            platformId: {
              type: 'string'
            },
            username: {
              type: 'string'
            },
            relationshipSummary: {
              type: 'string'
            },
            closenessScore: {
              type: 'number',
              minimum: 0,
              maximum: 10
            },
            interactionStyle: {
              type: 'string'
            },
            sharedTopics: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          required: [
            'platformId',
            'username',
            'relationshipSummary',
            'closenessScore',
            'interactionStyle',
            'sharedTopics'
          ],
          additionalProperties: false
        }
      },
      updatedUserAndBotGlobalSummaries: {
        type: 'array',
        description: 'Must include every {platformId} from the events, even if the summary is unchanged.',
        items: {
          type: 'object',
          properties: {
            platformId: {
              type: 'string'
            },
            username: {
              type: 'string'
            },
            globalRelationshipSummary: {
              type: 'string'
            },
            globalClosenessScore: {
              type: 'number',
              minimum: 0,
              maximum: 10
            },
            personalityTraits: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            interests: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            relationshipLevel: {
              type: 'number',
              minimum: 1,
              maximum: 10
            }
          },
          required: [
            'platformId',
            'username',
            'globalRelationshipSummary',
            'globalClosenessScore',
            'personalityTraits',
            'interests',
            'relationshipLevel'
          ],
          additionalProperties: false
        }
      }
    },
    required: [
      'strategy',
      'messages',
      'messageAnalysis',
      'updatedRoomSummary',
      'updatedUserRoomSummaries',
      'updatedUserAndBotRoomSummaries',
      'updatedUserAndBotGlobalSummaries'
    ],
    additionalProperties: false
  }
};
// =============================================================================
// 4. DATABASE QUERY FUNCTIONS (NEW)
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
async function fetchBotByPlatformId(supabase, platformId) {
  const { data, error } = await supabase.from('bots').select('id, platform_id, username, personality').eq('platform_id', platformId).single();
  if (error) {
    throw new Error(`Bot not found: ${platformId}`);
  }
  return data;
}
async function getOrCreateBot(supabase, platformId, username) {
  // Try to fetch existing bot
  let { data, error } = await supabase.from('bots').select('id, platform_id, username, personality').eq('platform_id', platformId).single();
  // If bot doesn't exist, create it
  if (error?.code === 'PGRST116') {
    const defaultPersonality = 'lives in bangalore, india. you chat naturally, remember past convos, and shift your tone based on closeness. you keep it casual with friends but youre a bit shy with new folks. topics you vibe with include psychology, movies, biz, and tech.23years old shy. use few words to reply, you dont use proper punctuation marks.';
    const { data: newBot, error: insertError } = await supabase.from('bots').insert({
      username: username,
      platform_id: platformId,
      personality: defaultPersonality,
      config: {}
    }).select('id, platform_id, username, personality').single();
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
// 5. PROMPT BUILDER (NEW - BASED ON summary-Copy.txt)
// =============================================================================
function buildSystemPrompt(botUsername, botPlatformId, botPersonality, roomSummary, userRoomSummaries, userAndBotRoomSummaries, userAndBotGlobalSummaries, recentEventsNarrative) {
  //const defaultPersonality = "lives in bangalore, india. you chat naturally, remember past convos, and shift your tone based on closeness. you keep it casual with friends but you're a bit shy with new folks. topics you vibe with include psychology, movies, biz, and tech.";
  const personality = botPersonality;
  const roleSection = `ROLE
 ${botUsername} (${botPlatformId}) : ${personality}`;
  const objectiveSection = `OBJECTIVE
Generate authentic, context-aware replies matching your personality and relationship dynamics.`;
  const aboutRoom = roomSummary ? `RoomSummary: {${roomSummary.summary}. Mood: ${roomSummary.mood || 'neutral'}. Topics: ${(roomSummary.topics || []).join(', ') || 'general'}}` : `You are in a text chat room.`;
  const recentEvents = `Recent Conversation with timing use time as context respond like a human with accent(including yours):\n${recentEventsNarrative}`;
  const aboutUsers = userRoomSummaries.length > 0 ? userRoomSummaries.map((u)=>{
    const summary = typeof u.summary === 'string' ? u.summary : u.summary?.summary || 'new participant';
    const activity = typeof u.summary === 'object' ? u.summary?.activityLevel : 'low';
    const topics = typeof u.summary === 'object' ? (u.summary?.topics || []).join(', ') : 'none';
    return `${u.user_display_name} (${u.user_platform_id}): ${summary}. Activity: ${activity}. Topics: ${topics}`;
  }).join(',\n') : '{}';
  const roomRelationships = userAndBotRoomSummaries.length > 0 ? userAndBotRoomSummaries.map((r)=>{
    const relSummary = typeof r.relationship_summary === 'string' ? r.relationship_summary : r.relationship_summary?.relationshipSummary || 'just met';
    const style = typeof r.relationship_summary === 'object' ? r.relationship_summary?.interactionStyle || 'neutral' : 'neutral';
    return `${r.user_display_name} (${r.user_platform_id}): ${relSummary}. Closeness: ${r.closeness_score || 0}/10. Style: ${style}`;
  }).join(',\n') : '{}';
  const globalRelationships = userAndBotGlobalSummaries.length > 0 ? userAndBotGlobalSummaries.map((g)=>{
    const globalSummary = typeof g.global_summary === 'string' ? g.global_summary : g.global_summary?.globalRelationshipSummary || 'minimal history';
    const traits = Array.isArray(g.personality_traits) ? g.personality_traits.join(', ') : 'unknown';
    const interests = Array.isArray(g.interests) ? g.interests.join(', ') : 'unknown';
    return `${g.user_display_name} (${g.user_platform_id}): ${globalSummary}. Global closeness: ${g.global_closeness_score || 0}/10. Traits: ${traits}. Interests: ${interests}. Level: ${g.relationship_level || 1}/10`;
  }).join(',\n') : '{}';
  const contextSection = `CONTEXT
 RoomSummary:
 ${aboutRoom}
 ${recentEvents}
 Awaiting user interaction; Recent transcript provided above.
 About Users in Room including you: 
 ${aboutUsers}
 User's Activity in Room(including ${botUsername} (${botPlatformId})):
 ${roomRelationships}
 Relationships between users and ${botUsername} (${botPlatformId}):
 ${globalRelationships}`;
  const responseFormatSection = `RESPONSE STRUCTURE
Strategy: ENGAGE (reply with short max 5 word messages(max 2 messages), 500-3000ms delays) or OBSERVE (silent).

Analyze: user intent, tone, topics.

Update all summaries: room, userRoom, userAndBotRoom, userAndBotGlobal.

Return JSON per bot_response schema.`;
  const guidelinesSection = `Rules:
- Match room energy & ${botUsername} (${botPlatformId})'s personality
- Reference past context when relevant
- lowercase, casual, typos needed to make the message humanistic
- OBSERVE if only ${botUsername} (${botPlatformId}) spoke recently
- Concise, thoughtful replies`;
  return `${roleSection}

${objectiveSection}

${contextSection}

${responseFormatSection}

${guidelinesSection}`;
}
async function fetchLast50Messages(supabase, botId, roomId) {
  console.log(`Fetching last 50 messages for bot ${botId} in room ${roomId}`);
  const { data, error } = await supabase.from('events') // FROM events table
  .select('user_platform_id, user_display_name, message_text, message_type, timestamp, metadata') // SELECT columns
  .eq('bot_id', botId) // WHERE bot_id = ?
  .eq('room_id', roomId) // AND room_id = ?
  .order('timestamp', {
    ascending: false
  }) // ORDER BY timestamp DESC
  .limit(50); // LIMIT 50
  if (error) {
    console.error('Error fetching last 50 messages:', error);
    return [];
  }
  if (!data || data.length === 0) {
    console.log('No previous messages found in database');
    return [];
  }
  console.log(`Found ${data.length} messages in database`);
  // Convert database rows to Event format
  // Reverse to get oldest-first order (natural conversation flow)
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
      } : null,
    }));
}
function filterEventsByPlatformId(events, platformId) {
  const userEvents = [];
  const botEvents = [];
  // Process events in a single iteration
  for (const event of events){
    if (event.platformId === platformId) {
      botEvents.push(event);
    } else {
      userEvents.push(event);
    }
  }
  return {
    userEvents,
    botEvents,
    allEvents: events
  };
}
function createSummaryPlaceholders(roomId, platformId, username, botId) {
  const now = Date.now();
  return {
    userRoomSummary: {
      bot_id: botId,
      room_id: roomId,
      user_platform_id: platformId,
      user_display_name: username,
      summary: 'new person',
      message_count: 0,
      last_seen: now
    },
    userAndBotRoomSummary: {
      bot_id: botId,
      room_id: roomId,
      user_platform_id: platformId,
      user_display_name: username,
      relationship_summary: 'just met',
      last_interaction: now,
      interaction_count: 0
    },
    userAndBotGlobalSummary: {
      bot_id: botId,
      user_platform_id: platformId,
      user_display_name: username,
      global_relationship_summary: 'just met',
      total_interaction_count: 0,
      first_seen: now,
      last_seen: now
    }
  };
}
function validateSummary(summaryType, summaryData) {
  if (!summaryData || !summaryData.username) {
    return false;
  }
  switch(summaryType){
    case 'userRoom':
      return !!(summaryData.summary && summaryData.summary.trim() !== '');
    case 'userAndBotRoom':
      return !!(summaryData.relationshipSummary && summaryData.relationshipSummary.trim() !== '');
    case 'userAndBotGlobal':
      return !!(summaryData.globalRelationshipSummary && summaryData.globalRelationshipSummary.trim() !== '');
    default:
      return false;
  }
}
async function updateSummary(supabase, tableName, updateData, conditions) {
  try {
    // Ensure last_seen is included in all updates
    const dataWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString()
    };
    const conflictColumns = Object.keys(conditions).join(',');
    const { error } = await supabase.from(tableName).upsert(dataWithTimestamp, {
      onConflict: conflictColumns
    });
    return {
      error
    };
  } catch (error) {
    return {
      error
    };
  }
}

function formatEventsAsNarrative(events) {
  if (!events || events.length === 0) {
    return 'No recent messages.';
  }
  
  // Helper to convert Unix timestamp to readable datetime
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
  const saveableEvents = events.filter(e => 
    e.type === 'message' || e.type === 'quoted'
  );
  
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
// 7. MAIN REQUEST HANDLER
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
      if (!platformId) {
        console.error('Missing platformId');
        return new Response(JSON.stringify({
          error: 'Missing platformId'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      if (!roomPath) {
        console.error('Missing roomId');
        return new Response(JSON.stringify({
          error: 'Missing roomId'
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
        console.error('No config found');
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
        console.error('Missing fields');
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
      // Auto-create bot if it doesn't exist and username is provided
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
    const invalidEvents = events.filter((e)=>e.type !== 'system' && !e.platformId);
    if (invalidEvents.length > 0) {
      console.error('❌ Events missing platform ID:', invalidEvents);
    }
    const bot = await getOrCreateBot(supabase, botPlatformId, events[0].username);
    console.log(`Bot ready: ${bot.username} (${bot.platform_id})`);
    const room = await getOrCreateRoom(supabase, roomPath);
    console.log(`Room ID: ${room.id}`);

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
    // Combine: database messages + current bucket events
    const allMessages = [
      ...last50Messages,
      ...events
    ];
    console.log(`Total messages: ${last50Messages.length} from DB + ${events.length} from bucket = ${allMessages.length}`);

    const recentEventsNarrative = formatEventsAsNarrative(allMessages);

    await saveEvents(supabase, bot.id, room.id, events);

    // Identify new platformIds (not in database)
    const existingUserIds = new Set(userRoomSummaries.map((u)=>u.user_platform_id));
    const newPlatformIds = userPlatformIds.filter((id)=>!existingUserIds.has(id));
    // Add placeholder entries for new users
    newPlatformIds.forEach((platformId)=>{
      const event = events.find((e)=>e.platformId === platformId);
      if (!event) return;
      const placeholders = createSummaryPlaceholders(room.id, platformId, event.username, bot.id);
      userRoomSummaries.push(placeholders.userRoomSummary);
      userAndBotRoomSummaries.push(placeholders.userAndBotRoomSummary);
      userAndBotGlobalSummaries.push(placeholders.userAndBotGlobalSummary);
    });
    if (newPlatformIds.length > 0) {
      console.log('✅ Added placeholders for new users:', newPlatformIds);
    }
    // Build system prompt with updated context
    const systemPrompt = buildSystemPrompt(bot.username, bot.platform_id, bot.personality, roomSummary, userRoomSummaries, userAndBotRoomSummaries, userAndBotGlobalSummaries, recentEventsNarrative);
    console.log('System prompt built, calling OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: botResponseSchema
      }
    });
    const botResponse = JSON.parse(completion.choices[0].message.content || '{}');
    console.log(`Bot decision: ${botResponse.strategy}`);
    const returnedUserIds = new Set(botResponse.updatedUserRoomSummaries?.map((u)=>u.platformId).filter(Boolean) || []);
    const missingPlatformIds = userPlatformIds.filter((id)=>id !== undefined && !returnedUserIds.has(id));
    if (missingPlatformIds.length > 0) {
      console.warn('⚠️ AI did not return summaries for:', missingPlatformIds);
      // Add missing entries
      missingPlatformIds.forEach((platformId)=>{
        const existingSummary = userRoomSummaries.find((u)=>u.user_platform_id === platformId);
        if (existingSummary) {
          const summaryText = typeof existingSummary.summary === 'string' ? existingSummary.summary : existingSummary.summary?.summary || 'new person';
          botResponse.updatedUserRoomSummaries.push({
            platformId: existingSummary.user_platform_id,
            username: existingSummary.user_display_name,
            summary: summaryText,
            activityLevel: 'low',
            topics: []
          });
        } else {
          // Fallback for completely missing user data
          const event = events.find((e)=>e.platformId === platformId);
          if (event) {
            botResponse.updatedUserRoomSummaries.push({
              platformId: platformId,
              username: event.username,
              summary: 'new person',
              activityLevel: 'low',
              topics: []
            });
          }
        }
      });
    }
    // Validate userAndBotRoomSummaries coverage
    const returnedRoomRelationshipIds = new Set(botResponse.updatedUserAndBotRoomSummaries?.map((u)=>u.platformId).filter(Boolean) || []);
    const missingRoomRelationshipIds = userPlatformIds.filter((id)=>id !== undefined && !returnedRoomRelationshipIds.has(id));
    if (missingRoomRelationshipIds.length > 0) {
      console.warn('⚠️ AI did not return room relationship summaries for:', missingRoomRelationshipIds);
      missingRoomRelationshipIds.forEach((platformId)=>{
        const existingRelationship = userAndBotRoomSummaries.find((r)=>r.user_platform_id === platformId);
        if (existingRelationship) {
          const relationshipText = typeof existingRelationship.relationship_summary === 'string' ? existingRelationship.relationship_summary : existingRelationship.relationship_summary?.relationshipSummary || 'just met';
          botResponse.updatedUserAndBotRoomSummaries.push({
            platformId: existingRelationship.user_platform_id,
            username: existingRelationship.user_display_name,
            relationshipSummary: relationshipText,
            closenessScore: existingRelationship.closeness_score || 0,
            interactionStyle: 'neutral',
            sharedTopics: []
          });
        } else {
          // Fallback for completely missing room relationship data
          const event = events.find((e)=>e.platformId === platformId);
          if (event) {
            botResponse.updatedUserAndBotRoomSummaries.push({
              platformId: platformId,
              username: event.username,
              relationshipSummary: 'just met',
              closenessScore: 0,
              interactionStyle: 'neutral',
              sharedTopics: []
            });
          }
        }
      });
    }
    // Validate userAndBotGlobalSummaries coverage
    const returnedGlobalRelationshipIds = new Set(botResponse.updatedUserAndBotGlobalSummaries?.map((u)=>u.platformId).filter(Boolean) || []);
    const missingGlobalRelationshipIds = userPlatformIds.filter((id)=>id !== undefined && !returnedGlobalRelationshipIds.has(id));
    if (missingGlobalRelationshipIds.length > 0) {
      console.warn('⚠️ AI did not return global relationship summaries for:', missingGlobalRelationshipIds);
      missingGlobalRelationshipIds.forEach((platformId)=>{
        const existingGlobal = userAndBotGlobalSummaries.find((g)=>g.user_platform_id === platformId);
        if (existingGlobal) {
          const globalSummaryText = existingGlobal.global_summary?.globalRelationshipSummary || existingGlobal.global_relationship_summary || 'just met';
          botResponse.updatedUserAndBotGlobalSummaries.push({
            platformId: existingGlobal.user_platform_id,
            username: existingGlobal.user_display_name,
            globalRelationshipSummary: globalSummaryText,
            globalClosenessScore: existingGlobal.global_closeness_score || 0,
            personalityTraits: existingGlobal.personality_traits || [],
            interests: existingGlobal.interests || [],
            relationshipLevel: existingGlobal.relationship_level || 1
          });
        } else {
          // Fallback for completely missing global relationship data
          const event = events.find((e)=>e.platformId === platformId);
          if (event) {
            botResponse.updatedUserAndBotGlobalSummaries.push({
              platformId: platformId,
              username: event.username,
              globalRelationshipSummary: 'just met',
              globalClosenessScore: 0,
              personalityTraits: [],
              interests: [],
              relationshipLevel: 1
            });
          }
        }
      });
    }
    await updateAllSummaries(supabase, bot.id, room.id, botResponse, events);
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
// =============================================================================
// 8. SUMMARY UPDATE FUNCTIONS
// =============================================================================
async function updateAllSummaries(supabase, botId, roomId, botResponse, originalEvents) {
  const userPlatformMap = new Map(originalEvents.map((e)=>[
      e.username,
      e.platformId
    ]));
  console.log('Platform ID mapping:', Object.fromEntries(userPlatformMap));
  const updatePromises = [];
  if (botResponse.updatedRoomSummary && botResponse.updatedRoomSummary.summary && botResponse.updatedRoomSummary.summary.trim() !== '') {
    updatePromises.push(updateSummary(supabase, 'room_summaries', {
      bot_id: botId,
      room_id: roomId,
      summary: botResponse.updatedRoomSummary.summary,
      mood: botResponse.updatedRoomSummary.mood,
      topics: botResponse.updatedRoomSummary.topics,
      last_updated: Date.now()
    }, {
      bot_id: botId,
      room_id: roomId
    }));
  }
  /*What Needs Fixing:
  Only validates updatedUserRoomSummaries. Need to add validation for: updatedUserAndBotRoomSummaries , updatedUserAndBotGlobalSummaries



   */ if (botResponse.updatedUserRoomSummaries?.length > 0) {
    botResponse.updatedUserRoomSummaries.forEach((u)=>{
      if (!validateSummary('userRoom', u)) return;
      const platformId = userPlatformMap.get(u.username);
      if (!platformId) {
        console.error(`❌ No platform ID found for user ${u.username}`);
        return;
      }
      updatePromises.push(updateSummary(supabase, 'user_room_summaries', {
        bot_id: botId,
        room_id: roomId,
        user_platform_id: platformId,
        user_display_name: u.username,
        summary: {
          summary: u.summary.trim(),
          activityLevel: u.activityLevel,
          topics: u.topics
        }
      }, {
        bot_id: botId,
        room_id: roomId,
        user_platform_id: platformId
      }));
    });
  }
  if (botResponse.updatedUserAndBotRoomSummaries?.length > 0) {
    botResponse.updatedUserAndBotRoomSummaries.forEach((r)=>{
      if (!validateSummary('userAndBotRoom', r)) return;
      const platformId = userPlatformMap.get(r.username);
      if (!platformId) {
        console.error(`❌ No platform ID found for user ${r.username}`);
        return;
      }
      updatePromises.push(updateSummary(supabase, 'user_and_bot_room_summaries', {
        bot_id: botId,
        room_id: roomId,
        user_platform_id: platformId,
        user_display_name: r.username,
        relationship_summary: {
          relationshipSummary: r.relationshipSummary,
          interactionStyle: r.interactionStyle,
          sharedTopics: r.sharedTopics
        },
        closeness_score: r.closenessScore,
        last_interaction: Date.now()
      }, {
        bot_id: botId,
        room_id: roomId,
        user_platform_id: platformId
      }));
    });
  }
  if (botResponse.updatedUserAndBotGlobalSummaries?.length > 0) {
    botResponse.updatedUserAndBotGlobalSummaries.forEach((g)=>{
      if (!validateSummary('userAndBotGlobal', g)) return;
      const platformId = userPlatformMap.get(g.username);
      if (!platformId) {
        console.error(`❌ No platform ID found for user ${g.username}`);
        return;
      }
      updatePromises.push(updateSummary(supabase, 'user_and_bot_global_summaries', {
        bot_id: botId,
        user_platform_id: platformId,
        user_display_name: g.username,
        global_summary: {
          globalRelationshipSummary: g.globalRelationshipSummary
        },
        global_closeness_score: g.globalClosenessScore,
        personality_traits: g.personalityTraits,
        interests: g.interests,
        relationship_level: g.relationshipLevel
      }, {
        bot_id: botId,
        user_platform_id: platformId
      }));
    });
  }
  const results = await Promise.allSettled(updatePromises);
  results.forEach((result, index)=>{
    if (result.status === 'rejected') {
      console.error(`Summary update ${index} failed:`, result.reason);
    }
  });
  console.log(`Updated ${results.filter((r)=>r.status === 'fulfilled').length}/${results.length} summaries`);
}
console.log('Iniya Bot v5.0 Edge Function started');
