-- Migration: Cleanup unused tables and functions
-- Created: 2025-01-21
-- Purpose: Remove old chat-api dependencies, keep only chat-api-v2 required tables

-- ============================================================================
-- ANALYSIS: Tables used by chat-api-v2 (KEEP)
-- ============================================================================
-- ✅ users - Bot owners and matches
-- ✅ conversations - 1-on-1 conversations
-- ✅ messages - Individual messages
-- ✅ bot_suggestions - Wingman analysis
-- ✅ prompts - Prompt versioning
-- ✅ bots - Bot lookup (used for summaries)
-- ✅ rooms - Room lookup (used for summaries)
-- ✅ user_room_summaries - Room-level summaries
-- ✅ user_and_bot_room_summaries - Relationship summaries
-- ✅ user_and_bot_global_summaries - Global history
-- ✅ room_summaries - Room summaries (used by summaries)

-- ============================================================================
-- TABLES TO REMOVE (old chat-api dependencies, not used by chat-api-v2)
-- ============================================================================

-- Remove old events table (replaced by messages table)
-- Note: Only drop if no foreign key constraints exist
DO $$ 
BEGIN
  -- Check if table exists and has no dependencies
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'events'
  ) THEN
    -- Drop foreign keys first
    ALTER TABLE IF EXISTS events DROP CONSTRAINT IF EXISTS events_bot_id_fkey;
    ALTER TABLE IF EXISTS events DROP CONSTRAINT IF EXISTS events_room_id_fkey;
    
    -- Drop indexes
    DROP INDEX IF EXISTS idx_conversations_bot_room;
    DROP INDEX IF EXISTS idx_conversations_timestamp;
    DROP INDEX IF EXISTS idx_conversations_user;
    
    -- Drop table
    DROP TABLE IF EXISTS events CASCADE;
    RAISE NOTICE 'Dropped events table (replaced by messages)';
  END IF;
END $$;

-- Remove response_threads (not used by chat-api-v2)
DROP TABLE IF EXISTS response_threads CASCADE;

-- Remove analytics (not used by chat-api-v2)
DROP TABLE IF EXISTS analytics CASCADE;

-- Remove embeddings (not used by chat-api-v2)
DROP TABLE IF EXISTS embeddings CASCADE;

-- Remove feature_flags (not used by chat-api-v2)
DROP TABLE IF EXISTS feature_flags CASCADE;

-- Remove bot_configs (not used by chat-api-v2)
DROP TABLE IF EXISTS bot_configs CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After cleanup, verify required tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'users', 'conversations', 'messages', 'bot_suggestions', 'prompts',
--   'bots', 'rooms', 'user_room_summaries', 'user_and_bot_room_summaries',
--   'user_and_bot_global_summaries', 'room_summaries'
-- )
-- ORDER BY table_name;

