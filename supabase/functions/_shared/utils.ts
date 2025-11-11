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
  senderId?: string; // Platform ID for group chat support
  senderName?: string; // Display name for group chat support
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
 * Supports both one-on-one and group conversations
 */
export async function getOrCreateConversation(
  botUserId: string,
  roomPath: string,
  matchUserId?: string | null,
  conversationType: 'one_on_one' | 'group' = 'one_on_one',
  targetUserId?: string | null,
  activeParticipants: string[] = []
): Promise<{ id: string; conversation_status: string; conversation_type?: string }> {
  const conversationData: any = {
    bot_user_id: botUserId,
    room_path: roomPath,
    match_user_id: matchUserId || null,
    conversation_type: conversationType,
    conversation_status: matchUserId ? 'active' : 'pending',
    updated_at: new Date().toISOString()
  };

  // For group conversations, add target_user_id and active_participants
  if (conversationType === 'group') {
    conversationData.target_user_id = targetUserId || null;
    conversationData.active_participants = activeParticipants;
    
    // Use UPSERT with conflict on (bot_user_id, room_path, target_user_id) for groups
    const { data, error } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: 'bot_user_id,room_path,target_user_id',
        ignoreDuplicates: false
      })
      .select('id, conversation_status, conversation_type')
      .single();
    
    if (error) {
      throw new Error(`Failed to create/get group conversation: ${error.message}`);
    }
    
    return data;
  } else {
    // For one-on-one, use existing unique constraint on (bot_user_id, room_path)
    const { data, error } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: 'bot_user_id,room_path',
        ignoreDuplicates: false
      })
      .select('id, conversation_status, conversation_type')
      .single();
    
    if (error) {
      throw new Error(`Failed to create/get conversation: ${error.message}`);
    }
    
    return data;
  }
}

/**
 * Update conversation with match_user_id
 * Uses UPSERT with conflict resolution to handle rapid girl switches
 * Supports both one-on-one and group conversations
 */
export async function updateConversationWithMatch(
  conversationId: string,
  matchUserId: string,
  conversationType: 'one_on_one' | 'group' = 'one_on_one',
  targetUserId?: string | null,
  activeParticipants: string[] = []
): Promise<void> {
  // First, get the conversation to get bot_user_id and room_path
  const { data: conversation, error: fetchError } = await supabase
    .from('conversations')
    .select('bot_user_id, room_path, conversation_type')
    .eq('id', conversationId)
    .single();
  
  if (fetchError || !conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const updateData: any = {
    match_user_id: matchUserId,
    conversation_status: 'active',
    conversation_type: conversationType,
    updated_at: new Date().toISOString()
  };

  // For group conversations, update target_user_id and active_participants
  if (conversationType === 'group') {
    updateData.target_user_id = targetUserId || null;
    updateData.active_participants = activeParticipants;
  }

  // Use UPSERT with conflict resolution on (bot_user_id, match_user_id) WHERE match_user_id IS NOT NULL
  // This handles rapid girl switches without duplicate key violations
  const { error } = await supabase
    .from('conversations')
    .upsert({
      bot_user_id: conversation.bot_user_id,
      room_path: conversation.room_path,
      match_user_id: matchUserId,
      conversation_type: conversationType,
      conversation_status: 'active',
      target_user_id: conversationType === 'group' ? (targetUserId || null) : undefined,
      active_participants: conversationType === 'group' ? activeParticipants : undefined,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'bot_user_id,room_path',
      ignoreDuplicates: false
    })
    .eq('id', conversationId);
  
  if (error) {
    // If UPSERT fails, try direct update as fallback
    const { error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);
    
    if (updateError) {
      throw new Error(`Failed to update conversation: ${updateError.message}`);
    }
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
 * Supports both one-on-one and group chat formatting
 */
export function formatRecentMessages(
  messages: Message[], 
  isGroupChat: boolean = false,
  userId?: string
): string {
  if (!messages || messages.length === 0) {
    return 'No recent messages.';
  }
  
  // Take last 10 messages
  const recent = messages.slice(-10);
  
  return recent.map((msg, idx) => {
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    
    // For group chats, include sender name/ID
    if (isGroupChat) {
      // Use senderName if available, otherwise senderId, otherwise fallback to sender enum
      let senderLabel: string;
      if (msg.sender === 'user') {
        senderLabel = 'You';
      } else if (msg.senderName) {
        senderLabel = msg.senderName;
      } else if (msg.senderId && msg.senderId !== userId) {
        senderLabel = msg.senderId;
      } else {
        senderLabel = msg.sender === 'girl' ? 'Match' : 'Unknown';
      }
      return `[${timestamp}] ${senderLabel}: "${msg.text}"`;
    } else {
      // One-on-one format (backward compatible)
      const sender = msg.sender === 'user' ? 'You' : 'Her';
      return `[${timestamp}] ${sender}: "${msg.text}"`;
    }
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
 * Detect and update user gender from conversation messages
 * Uses simple heuristics to infer gender from message content
 * Only updates if gender is currently 'unknown'
 */
export async function detectAndUpdateGender(
  userId: string,
  messages: Array<{ text: string; sender: 'user' | 'girl' }>,
  userType: 'bot_owner' | 'match' = 'match'
): Promise<'unknown' | 'male' | 'female' | 'non_binary'> {
  // Only process match users (not bot owners)
  if (userType !== 'match') {
    return 'unknown';
  }

  // Get current user to check if gender is already known
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('gender, profile_data')
    .eq('platform_id', userId)
    .single();

  if (fetchError || !user) {
    return 'unknown';
  }

  // If gender is already known, don't update
  if (user.gender && user.gender !== 'unknown') {
    return user.gender as 'male' | 'female' | 'non_binary';
  }

  // Simple heuristics to detect gender from messages
  // Look for gender indicators in message text
  const allText = messages.map(m => m.text.toLowerCase()).join(' ');
  
  // Female indicators (common patterns)
  const femaleIndicators = [
    /\b(she|her|hers|herself)\b/gi,
    /\b(girl|woman|lady|female)\b/gi,
    /\b(daughter|sister|mom|mother|aunt|niece)\b/gi,
    /\b(princess|queen|goddess)\b/gi
  ];

  // Male indicators
  const maleIndicators = [
    /\b(he|him|his|himself)\b/gi,
    /\b(boy|man|guy|male)\b/gi,
    /\b(son|brother|dad|father|uncle|nephew)\b/gi,
    /\b(prince|king|dude)\b/gi
  ];

  let femaleScore = 0;
  let maleScore = 0;

  for (const pattern of femaleIndicators) {
    const matches = allText.match(pattern);
    if (matches) {
      femaleScore += matches.length;
    }
  }

  for (const pattern of maleIndicators) {
    const matches = allText.match(pattern);
    if (matches) {
      maleScore += matches.length;
    }
  }

  // Determine gender based on scores (need at least 2 indicators to be confident)
  let detectedGender: 'unknown' | 'male' | 'female' | 'non_binary' = 'unknown';
  
  if (femaleScore >= 2 && femaleScore > maleScore * 1.5) {
    detectedGender = 'female';
  } else if (maleScore >= 2 && maleScore > femaleScore * 1.5) {
    detectedGender = 'male';
  }

  // Only update if we detected a gender
  if (detectedGender !== 'unknown') {
    const updatedProfileData = {
      ...(user.profile_data || {}),
      gender: detectedGender
    };

    const { error: updateError } = await supabase
      .from('users')
      .update({
        gender: detectedGender,
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('platform_id', userId);

    if (!updateError) {
      console.log(`✅ Detected gender for user ${userId}: ${detectedGender}`);
    }
  }

  return detectedGender;
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
): Promise<string | null> {
  const { data, error } = await supabase
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
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to store bot suggestion:', error);
    // Don't throw - suggestion storage is not critical for response
    return null;
  }
  
  return data?.id || null;
}

