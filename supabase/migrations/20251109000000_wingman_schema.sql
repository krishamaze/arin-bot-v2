-- Migration: Wingman Dating Chat Helper Schema
-- Created: 2025-11-09
-- Purpose: Create new schema for Wingman dating assistant with optimized JSONB indexes

-- ============================================================================
-- 1. UNIFIED USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT UNIQUE NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('bot_owner', 'match')),
  display_name TEXT NOT NULL,
  profile_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_platform_id ON users(platform_id);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);

-- JSONB indexes for profile queries
CREATE INDEX IF NOT EXISTS idx_users_profile_data_gin ON users USING GIN (profile_data);
CREATE INDEX IF NOT EXISTS idx_users_age ON users ((profile_data->>'age')) WHERE user_type = 'match';
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN ((profile_data->'interests')) WHERE user_type = 'match';

-- ============================================================================
-- 2. CONVERSATIONS TABLE (with nullable match_user_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- Nullable for initialization
  room_path TEXT NOT NULL,
  conversation_status TEXT DEFAULT 'pending' 
    CHECK (conversation_status IN ('pending', 'active', 'paused', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bot_user_id, room_path)
);

-- Indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_bot_match ON conversations(bot_user_id, match_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_metadata_gin ON conversations USING GIN (metadata);

-- Partial unique index for active conversations only
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_bot_match_active 
  ON conversations(bot_user_id, match_user_id) 
  WHERE match_user_id IS NOT NULL;

-- ============================================================================
-- 3. MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'user' 
    CHECK (message_type IN ('user', 'bot_suggestion', 'sent')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'flirty', 'serious', 'confused')),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Partial index for sentiment analysis
CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON messages (conversation_id, sentiment) 
  WHERE sentiment IS NOT NULL;

-- ============================================================================
-- 4. BOT SUGGESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bot_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  prompt_context JSONB NOT NULL,
  analysis JSONB,
  suggestions JSONB NOT NULL,
  wingman_tip TEXT,
  user_selected_index INTEGER,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  response_time_ms INTEGER,
  cached_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for bot_suggestions table
CREATE INDEX IF NOT EXISTS idx_bot_suggestions_conversation ON bot_suggestions(conversation_id, created_at DESC);

-- ============================================================================
-- DOWN: Rollback (commented for reference)
-- ============================================================================

-- DROP TABLE IF EXISTS bot_suggestions CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

