// Helper functions for Wingman edge function
import { supabase } from './supabaseClient.ts';

export interface UserProfile {
  id: string;
  platform_id: string;
  display_name: string;
  profile_data: any;
}

export interface Message {
  sender: 'user' | 'girl';
  text: string;
  timestamp: number;
}

/**
 * Fetch user profile by platform_id and user_type
 */
export async function fetchUserProfile(
  platformId: string,
  userType: 'bot_owner' | 'match'
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('id, platform_id, display_name, profile_data')
    .eq('platform_id', platformId)
    .eq('user_type', userType)
    .single();
  
  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
  
  if (!data) {
    throw new Error(`User not found: ${platformId} (${userType})`);
  }
  
  return data as UserProfile;
}

/**
 * Get or create user
 */
export async function getOrCreateUser(
  platformId: string,
  displayName: string,
  userType: 'bot_owner' | 'match',
  profileData: any = {}
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      platform_id: platformId,
      user_type: userType,
      display_name: displayName,
      profile_data: profileData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'platform_id',
      ignoreDuplicates: false
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create/get user: ${error.message}`);
  }
  
  return data as UserProfile;
}

/**
 * Get or create conversation
 */
export async function getOrCreateConversation(
  botUserId: string,
  roomPath: string,
  matchUserId?: string | null
): Promise<{ id: string; conversation_status: string }> {
  const { data, error } = await supabase
    .from('conversations')
    .upsert({
      bot_user_id: botUserId,
      room_path: roomPath,
      match_user_id: matchUserId || null,
      conversation_status: matchUserId ? 'active' : 'pending',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'bot_user_id,room_path',
      ignoreDuplicates: false
    })
    .select('id, conversation_status')
    .single();
  
  if (error) {
    throw new Error(`Failed to create/get conversation: ${error.message}`);
  }
  
  return data;
}

/**
 * Update conversation with match_user_id
 */
export async function updateConversationWithMatch(
  conversationId: string,
  matchUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      match_user_id: matchUserId,
      conversation_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
    .is('match_user_id', null);  // Only update if not already set
  
  if (error) {
    throw new Error(`Failed to update conversation: ${error.message}`);
  }
}

/**
 * Store messages in database
 */
export async function storeMessages(
  conversationId: string,
  messages: Message[],
  userPlatformId: string,
  girlPlatformId: string
): Promise<void> {
  if (!messages || messages.length === 0) {
    return;
  }
  
  try {
    // Get user IDs for sender lookup
    const userProfile = await fetchUserProfile(userPlatformId, 'bot_owner');
    const girlProfile = await fetchUserProfile(girlPlatformId, 'match');
    
    const messageRecords = messages.map(msg => ({
      conversation_id: conversationId,
      sender_id: msg.sender === 'user' ? userProfile.id : girlProfile.id,
      message_text: msg.text,
      message_type: msg.sender === 'user' ? 'user' : 'user',
      timestamp: msg.timestamp,
      created_at: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('messages')
      .insert(messageRecords);
    
    if (error) {
      console.error('Failed to store messages:', error);
      // Don't throw - message storage is not critical for response generation
    }
  } catch (error: any) {
    console.error('Error storing messages:', error.message);
    // Don't throw - message storage is not critical
  }
}

/**
 * Format recent messages for prompt
 */
export function formatRecentMessages(messages: Message[]): string {
  if (!messages || messages.length === 0) {
    return 'No recent messages.';
  }
  
  // Take last 10 messages
  const recent = messages.slice(-10);
  
  return recent.map((msg, idx) => {
    const sender = msg.sender === 'user' ? 'You' : 'Her';
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    return `[${timestamp}] ${sender}: "${msg.text}"`;
  }).join('\n');
}

/**
 * Format user info for cache
 */
export function formatUserInfo(profile: UserProfile): string {
  return `Name: ${profile.display_name}\nProfile: ${JSON.stringify(profile.profile_data, null, 2)}`;
}

/**
 * Fetch user room summaries
 */
export async function fetchUserRoomSummaries(
  botId: string,
  roomId: string,
  userPlatformIds: string[]
): Promise<any[]> {
  if (userPlatformIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('user_room_summaries')
    .select('user_platform_id, user_display_name, summary')
    .eq('bot_id', botId)
    .eq('room_id', roomId)
    .in('user_platform_id', userPlatformIds);
  
  if (error) {
    console.error('Error fetching user room summaries:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Fetch user and bot room summaries (includes closeness_score and interaction_count)
 */
export async function fetchUserAndBotRoomSummaries(
  botId: string,
  roomId: string,
  userPlatformIds: string[]
): Promise<any[]> {
  if (userPlatformIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('user_and_bot_room_summaries')
    .select('user_platform_id, user_display_name, relationship_summary, closeness_score, interaction_count')
    .eq('bot_id', botId)
    .eq('room_id', roomId)
    .in('user_platform_id', userPlatformIds);
  
  if (error) {
    console.error('Error fetching user-bot room summaries:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Fetch user and bot global summaries
 */
export async function fetchUserAndBotGlobalSummaries(
  botId: string,
  userPlatformIds: string[]
): Promise<any[]> {
  if (userPlatformIds.length === 0) return [];
  
  const { data, error } = await supabase
    .from('user_and_bot_global_summaries')
    .select('user_platform_id, user_display_name, global_summary')
    .eq('bot_id', botId)
    .in('user_platform_id', userPlatformIds);
  
  if (error) {
    console.error('Error fetching global summaries:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Calculate tone level based on closeness_score and interaction_count
 */
export function calculateToneLevel(
  closenessScore: number | null,
  interactionCount: number | null
): string {
  // Default values if null
  const score = closenessScore ?? 0;
  const count = interactionCount ?? 0;
  
  // Base tone level from closeness_score
  let toneLevel: string;
  if (score <= 3) {
    toneLevel = 'very_shy';
  } else if (score <= 6) {
    toneLevel = 'warming_up';
  } else {
    toneLevel = 'casual_friend';
  }
  
  // Adjust based on interaction_count
  if (count < 5) {
    // Reduce tone level (more cautious)
    if (toneLevel === 'casual_friend') {
      toneLevel = 'warming_up';
    } else if (toneLevel === 'warming_up') {
      toneLevel = 'very_shy';
    }
  } else if (count > 20) {
    // Increase tone level (more relaxed)
    if (toneLevel === 'very_shy') {
      toneLevel = 'warming_up';
    } else if (toneLevel === 'warming_up') {
      toneLevel = 'casual_friend';
    }
  }
  
  return toneLevel;
}

/**
 * Store bot suggestion in database
 */
export async function storeBotSuggestion(
  conversationId: string,
  promptContext: any,
  analysis: any,
  suggestions: any[],
  wingmanTip: string,
  responseTime: number,
  cachedTokens: number,
  modelUsed: string = 'gemini-1.5-flash-001'
): Promise<void> {
  const { error } = await supabase
    .from('bot_suggestions')
    .insert({
      conversation_id: conversationId,
      prompt_context: promptContext,
      analysis: analysis,
      suggestions: suggestions,
      wingman_tip: wingmanTip,
      response_time_ms: responseTime,
      cached_tokens: cachedTokens,
      model_used: modelUsed
    });
  
  if (error) {
    console.error('Failed to store bot suggestion:', error);
    // Don't throw - suggestion storage is not critical for response
  }
}

