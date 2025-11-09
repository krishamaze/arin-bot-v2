-- Migration: Add indexes and constraints for database optimization
-- Created: 2025-01-20
-- Purpose: Optimize query performance based on application query patterns

-- ============================================================================
-- 1. BOTS TABLE OPTIMIZATION
-- ============================================================================

-- Index on platform_id (frequently queried in getOrCreateBot)
CREATE INDEX IF NOT EXISTS idx_bots_platform_id ON bots(platform_id);

-- Unique constraint on username (used in upsert with onConflict)
-- Note: If unique constraint already exists, this will be ignored
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bots_username_key' 
    AND conrelid = 'bots'::regclass
  ) THEN
    ALTER TABLE bots ADD CONSTRAINT bots_username_key UNIQUE (username);
  END IF;
END $$;

-- Index on username for faster lookups (helps with unique constraint)
CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username);

-- ============================================================================
-- 2. ROOMS TABLE OPTIMIZATION
-- ============================================================================

-- Index on room_id (frequently queried in getOrCreateRoom)
CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON rooms(room_id);

-- Unique constraint on room_id (should be unique per room)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rooms_room_id_key' 
    AND conrelid = 'rooms'::regclass
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT rooms_room_id_key UNIQUE (room_id);
  END IF;
END $$;

-- ============================================================================
-- 3. EVENTS TABLE OPTIMIZATION
-- ============================================================================

-- Composite index for the main query: fetchLast50Messages
-- Query: WHERE bot_id = ? AND room_id = ? ORDER BY timestamp DESC LIMIT 50
-- This index supports the WHERE clause and ORDER BY efficiently
CREATE INDEX IF NOT EXISTS idx_events_bot_room_timestamp_desc 
ON events(bot_id, room_id, timestamp DESC);

-- Index on bot_id for filtering (helps with other queries)
CREATE INDEX IF NOT EXISTS idx_events_bot_id ON events(bot_id);

-- Index on room_id for filtering
CREATE INDEX IF NOT EXISTS idx_events_room_id ON events(room_id);

-- Index on timestamp for time-based queries
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- Foreign key constraint to bots table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_bot_id_fkey' 
    AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_bot_id_fkey 
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Foreign key constraint to rooms table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_room_id_fkey' 
    AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_room_id_fkey 
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. ROOM_SUMMARIES TABLE OPTIMIZATION
-- ============================================================================

-- Composite index for room summary queries
-- Query: WHERE bot_id = ? AND room_id = ?
CREATE INDEX IF NOT EXISTS idx_room_summaries_bot_room 
ON room_summaries(bot_id, room_id);

-- Unique constraint to ensure one summary per bot-room combination
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'room_summaries_bot_room_key' 
    AND conrelid = 'room_summaries'::regclass
  ) THEN
    ALTER TABLE room_summaries 
    ADD CONSTRAINT room_summaries_bot_room_key UNIQUE (bot_id, room_id);
  END IF;
END $$;

-- ============================================================================
-- 5. USER_ROOM_SUMMARIES TABLE OPTIMIZATION
-- ============================================================================

-- Composite index for user room summary queries
-- Query: WHERE bot_id = ? AND room_id = ? AND user_platform_id IN (...)
CREATE INDEX IF NOT EXISTS idx_user_room_summaries_bot_room_user 
ON user_room_summaries(bot_id, room_id, user_platform_id);

-- Index on user_platform_id for IN clause optimization
CREATE INDEX IF NOT EXISTS idx_user_room_summaries_user_platform_id 
ON user_room_summaries(user_platform_id);

-- Unique constraint to ensure one summary per bot-room-user combination
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_room_summaries_bot_room_user_key' 
    AND conrelid = 'user_room_summaries'::regclass
  ) THEN
    ALTER TABLE user_room_summaries 
    ADD CONSTRAINT user_room_summaries_bot_room_user_key 
    UNIQUE (bot_id, room_id, user_platform_id);
  END IF;
END $$;

-- ============================================================================
-- 6. USER_AND_BOT_ROOM_SUMMARIES TABLE OPTIMIZATION
-- ============================================================================

-- Composite index for user-bot room summary queries
-- Query: WHERE bot_id = ? AND room_id = ? AND user_platform_id IN (...)
CREATE INDEX IF NOT EXISTS idx_user_and_bot_room_summaries_bot_room_user 
ON user_and_bot_room_summaries(bot_id, room_id, user_platform_id);

-- Index on user_platform_id for IN clause optimization
CREATE INDEX IF NOT EXISTS idx_user_and_bot_room_summaries_user_platform_id 
ON user_and_bot_room_summaries(user_platform_id);

-- Unique constraint to ensure one summary per bot-room-user combination
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_and_bot_room_summaries_bot_room_user_key' 
    AND conrelid = 'user_and_bot_room_summaries'::regclass
  ) THEN
    ALTER TABLE user_and_bot_room_summaries 
    ADD CONSTRAINT user_and_bot_room_summaries_bot_room_user_key 
    UNIQUE (bot_id, room_id, user_platform_id);
  END IF;
END $$;

-- ============================================================================
-- 7. USER_AND_BOT_GLOBAL_SUMMARIES TABLE OPTIMIZATION
-- ============================================================================

-- Composite index for global summary queries
-- Query: WHERE bot_id = ? AND user_platform_id IN (...)
CREATE INDEX IF NOT EXISTS idx_user_and_bot_global_summaries_bot_user 
ON user_and_bot_global_summaries(bot_id, user_platform_id);

-- Index on user_platform_id for IN clause optimization
CREATE INDEX IF NOT EXISTS idx_user_and_bot_global_summaries_user_platform_id 
ON user_and_bot_global_summaries(user_platform_id);

-- Unique constraint to ensure one global summary per bot-user combination
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_and_bot_global_summaries_bot_user_key' 
    AND conrelid = 'user_and_bot_global_summaries'::regclass
  ) THEN
    ALTER TABLE user_and_bot_global_summaries 
    ADD CONSTRAINT user_and_bot_global_summaries_bot_user_key 
    UNIQUE (bot_id, user_platform_id);
  END IF;
END $$;

-- ============================================================================
-- 8. ADD NOT NULL CONSTRAINTS WHERE APPROPRIATE
-- ============================================================================
-- Note: These constraints will only be added if columns don't already have NULL values
-- If you have existing NULL values, you'll need to update them first

-- Bots table
DO $$ 
BEGIN
  -- Only add NOT NULL if no NULL values exist
  IF NOT EXISTS (SELECT 1 FROM bots WHERE platform_id IS NULL) THEN
    ALTER TABLE bots ALTER COLUMN platform_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bots WHERE username IS NULL) THEN
    ALTER TABLE bots ALTER COLUMN username SET NOT NULL;
  END IF;
END $$;

-- Rooms table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE room_id IS NULL) THEN
    ALTER TABLE rooms ALTER COLUMN room_id SET NOT NULL;
  END IF;
END $$;

-- Events table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE bot_id IS NULL) THEN
    ALTER TABLE events ALTER COLUMN bot_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE room_id IS NULL) THEN
    ALTER TABLE events ALTER COLUMN room_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE timestamp IS NULL) THEN
    ALTER TABLE events ALTER COLUMN timestamp SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM events WHERE message_text IS NULL) THEN
    ALTER TABLE events ALTER COLUMN message_text SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 9. VERIFY INDEXES CREATED
-- ============================================================================

-- This query can be run to verify all indexes were created
-- SELECT
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

