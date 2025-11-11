-- Migration: Add Gender and Group Chat Support
-- Created: 2025-01-22
-- Purpose: Add gender tracking to users and enable group chat support in conversations

-- ============================================================================
-- 1. ADD GENDER COLUMN TO USERS TABLE
-- ============================================================================

-- Add gender column with check constraint
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS gender TEXT 
CHECK (gender IN ('unknown', 'male', 'female', 'non_binary')) 
DEFAULT 'unknown';

-- Add index on gender for filtering
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender) WHERE gender != 'unknown';

-- Update existing users to have gender in profile_data if not present
UPDATE users 
SET profile_data = jsonb_set(
  COALESCE(profile_data, '{}'::jsonb),
  '{gender}',
  to_jsonb(COALESCE(gender, 'unknown'))
)
WHERE profile_data->>'gender' IS NULL;

-- ============================================================================
-- 2. UPDATE CONVERSATIONS TABLE FOR GROUP SUPPORT
-- ============================================================================

-- Add conversation_type column
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS conversation_type TEXT 
CHECK (conversation_type IN ('one_on_one', 'group')) 
DEFAULT 'one_on_one';

-- Add active_participants JSONB column (array of user IDs)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS active_participants JSONB DEFAULT '[]'::jsonb;

-- Add target_user_id column (the person bot owner is currently talking to)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Drop the old partial unique index that prevents multiple conversations per room
DROP INDEX IF EXISTS idx_conversations_bot_match_active;

-- Drop the table-level unique constraint on (bot_user_id, room_path) to allow group chats
-- We'll replace it with partial unique indexes
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_bot_user_id_room_path_key;

-- Create new index for efficient lookups by bot, room, and conversation type
CREATE INDEX IF NOT EXISTS idx_conversations_bot_room_type 
ON conversations(bot_user_id, room_path, conversation_type);

-- Create index for group conversations with target user
CREATE INDEX IF NOT EXISTS idx_conversations_group_target 
ON conversations(bot_user_id, room_path, target_user_id) 
WHERE conversation_type = 'group' AND target_user_id IS NOT NULL;

-- Create unique constraint for one-on-one conversations (keep existing behavior)
-- For group chats, we allow multiple conversations per room with different target_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_one_on_one_unique
ON conversations(bot_user_id, room_path)
WHERE conversation_type = 'one_on_one' OR conversation_type IS NULL;

-- Create unique constraint for group conversations per target user
-- This allows multiple group conversations per room, each with a different target_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_group_unique
ON conversations(bot_user_id, room_path, target_user_id)
WHERE conversation_type = 'group' AND target_user_id IS NOT NULL;

-- Update existing conversations to have conversation_type = 'one_on_one'
UPDATE conversations 
SET conversation_type = 'one_on_one'
WHERE conversation_type IS NULL;

-- ============================================================================
-- 3. UPDATE MESSAGES TABLE FOR GROUP SUPPORT
-- ============================================================================

-- Add sender_platform_id for quick lookups without joins
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sender_platform_id TEXT;

-- Create index for group message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender_time 
ON messages(conversation_id, sender_platform_id, timestamp DESC);

-- Update existing messages to populate sender_platform_id from users table
-- This is a one-time migration for existing data
UPDATE messages m
SET sender_platform_id = u.platform_id
FROM users u
WHERE m.sender_id = u.id 
AND m.sender_platform_id IS NULL;

-- ============================================================================
-- NOTES
-- ============================================================================

-- The unique constraint idx_conversations_bot_match_active was dropped to allow
-- multiple active conversations per room in group chats. Instead:
-- - One-on-one: One conversation per (bot_user_id, room_path)
-- - Group: Multiple conversations per (bot_user_id, room_path) with different target_user_id

