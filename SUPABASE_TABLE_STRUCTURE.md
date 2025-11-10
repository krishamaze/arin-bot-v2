# Supabase Table Structure

*Generated from cloud database schema on 2025-11-09*

Current database schema for arin-bot-v2 project.

## Tables

### 1. `analytics`

Stores analytics and performance metrics for bot interactions.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID)
- `room_id` (UUID)
- `event_type` (TEXT, NOT NULL)
- `event_data` (JSONB) - Default: `'{}'::jsonb`
- `response_time_ms` (INTEGER)
- `created_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_analytics_bot` - Columns: bot_id
- `idx_analytics_time` - Columns: created_at DESC
- `idx_analytics_type` - Columns: event_type

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`analytics_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`analytics_room_id_fkey`)

---

### 2. `bot_configs`

Stores bot configuration per room.

**Columns:**
- `id` (INTEGER, NOT NULL, PRIMARY KEY) - Default: `nextval('bot_configs_id_seq'::regclass)`
- `room_id` (TEXT, NOT NULL)
- `platform_id` (TEXT, NOT NULL)
- `updated_at` (TIMESTAMP WITHOUT TIME ZONE) - Default: `now()`

**Indexes:**
- `bot_configs_room_platform_unique` (UNIQUE) - Columns: room_id, platform_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`platform_id`, `room_id`) (`bot_configs_room_platform_unique`)

---

### 3. `bots`

Stores bot information and personalities.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `username` (TEXT, NOT NULL)
- `personality` (TEXT)
- `config` (JSONB) - Default: `'{}'::jsonb`
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `last_active` (TIMESTAMPTZ) - Default: `now()`
- `platform_id` (TEXT)

**Indexes:**
- `bots_platform_id_unique` (UNIQUE) - Columns: platform_id
- `bots_username_key` (UNIQUE) - Columns: username
- `idx_bots_platform_id` - Columns: platform_id
- `idx_bots_username` - Columns: username

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `platform_id` (`bots_platform_id_unique`)
- UNIQUE: `username` (`bots_username_key`)

---

### 4. `embeddings`

Stores vector embeddings for semantic search and retrieval.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID)
- `room_id` (UUID)
- `content` (TEXT, NOT NULL)
- `embedding` (USER-DEFINED)
- `metadata` (JSONB) - Default: `'{}'::jsonb`
- `created_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_embeddings_bot_room` - Columns: bot_id, room_id
- `idx_embeddings_vector` - Columns: embedding vector_cosine_ops

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`embeddings_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`embeddings_room_id_fkey`)

---

### 5. `events`

Stores chat events/messages.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID)
- `room_id` (UUID)
- `user_platform_id` (TEXT, NOT NULL)
- `user_display_name` (TEXT, NOT NULL)
- `message_text` (TEXT, NOT NULL)
- `message_type` (TEXT) - Default: `'user'::text`
- `metadata` (JSONB) - Default: `'{}'::jsonb`
- `timestamp` (BIGINT, NOT NULL)
- `created_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_conversations_bot_room` - Columns: bot_id, room_id
- `idx_conversations_timestamp` - Columns: "timestamp" DESC
- `idx_conversations_user` - Columns: user_platform_id

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`events_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`events_room_id_fkey`)

---

### 6. `feature_flags`

Stores feature flags and configuration for bots.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID, NOT NULL)
- `flag_name` (TEXT, NOT NULL)
- `enabled` (BOOLEAN) - Default: `false`
- `config` (JSONB) - Default: `'{}'::jsonb`
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `feature_flags_bot_id_flag_name_key` (UNIQUE) - Columns: bot_id, flag_name
- `idx_feature_flags_bot_flag` - Columns: bot_id, flag_name

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`flag_name`, `bot_id`) (`feature_flags_bot_id_flag_name_key`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`feature_flags_bot_id_fkey`)

---

### 7. `response_threads`

Stores response thread information for bot conversations.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID, NOT NULL)
- `room_id` (UUID, NOT NULL)
- `last_response_id` (TEXT)
- `model_used` (TEXT) - Default: `'gpt-4.1'::text`
- `api_version` (TEXT) - Default: `'v6'::text`
- `metadata` (JSONB) - Default: `'{}'::jsonb`
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_response_threads_bot_room` - Columns: bot_id, room_id
- `response_threads_bot_id_room_id_key` (UNIQUE) - Columns: bot_id, room_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`bot_id`, `room_id`) (`response_threads_bot_id_room_id_key`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`response_threads_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`response_threads_room_id_fkey`)

---

### 8. `room_summaries`

Stores room-level conversation summaries.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID)
- `room_id` (UUID)
- `summary` (TEXT, NOT NULL)
- `mood` (TEXT)
- `topics` (JSONB) - Default: `'[]'::jsonb`
- `last_updated` (BIGINT, NOT NULL)
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `active_conversation_topics` (JSONB) - Default: `'[]'::jsonb`
- `conversation_style` (TEXT) - Default: `'casual'::text`
- `participant_count` (INTEGER) - Default: `0`

**Indexes:**
- `idx_room_summaries_bot_room` - Columns: bot_id, room_id
- `idx_room_summaries_lookup` - Columns: bot_id, room_id
- `room_summaries_bot_id_room_id_key` (UNIQUE) - Columns: bot_id, room_id
- `room_summaries_bot_room_unique` (UNIQUE) - Columns: bot_id, room_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`bot_id`, `room_id`) (`room_summaries_bot_id_room_id_key`)
- UNIQUE: (`room_id`, `bot_id`) (`room_summaries_bot_room_unique`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`room_summaries_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`room_summaries_room_id_fkey`)

---

### 9. `rooms`

Stores room/chat room information.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `room_id` (TEXT, NOT NULL)
- `server_name` (TEXT)
- `channel_name` (TEXT)
- `metadata` (JSONB) - Default: `'{}'::jsonb`
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `room_path` (TEXT)

**Indexes:**
- `idx_rooms_path` - Columns: room_path
- `idx_rooms_room_id` - Columns: room_id
- `rooms_room_id_key` (UNIQUE) - Columns: room_id
- `rooms_room_path_key` (UNIQUE) - Columns: room_path

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `room_id` (`rooms_room_id_key`)
- UNIQUE: `room_path` (`rooms_room_path_key`)

---

### 10. `user_and_bot_global_summaries`

Stores global summaries of user and bot interactions across all rooms.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID, NOT NULL)
- `user_platform_id` (TEXT, NOT NULL)
- `user_display_name` (TEXT, NOT NULL)
- `global_summary` (JSONB) - Default: `'{}'::jsonb`
- `total_message_count` (INTEGER) - Default: `0`
- `total_interaction_count` (INTEGER) - Default: `0`
- `global_closeness_score` (NUMERIC(null)) - Default: `0.0`
- `notes` (JSONB) - Default: `'{}'::jsonb`
- `personality_traits` (JSONB) - Default: `'[]'::jsonb`
- `interests` (JSONB) - Default: `'[]'::jsonb`
- `relationship_level` (INTEGER) - Default: `1`
- `is_active` (BOOLEAN) - Default: `true`
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`
- `first_seen` (BIGINT)
- `last_seen` (BIGINT)

**Indexes:**
- `idx_user_global_bot_platform` - Columns: bot_id, user_platform_id
- `idx_usern_bot_global_summaries_lookup` - Columns: bot_id, user_platform_id
- `usern_and_bot_global_summaries_unique` (UNIQUE) - Columns: bot_id, user_platform_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`bot_id`, `user_platform_id`) (`usern_and_bot_global_summaries_unique`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`usern_and_bot_global_summaries_bot_id_fkey`)

---

### 11. `user_and_bot_room_summaries`

Stores summaries combining user and bot interactions in a room.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID, NOT NULL)
- `room_id` (UUID, NOT NULL)
- `user_platform_id` (TEXT, NOT NULL)
- `user_display_name` (TEXT, NOT NULL)
- `relationship_summary` (JSONB) - Default: `'{}'::jsonb`
- `interaction_count` (INTEGER) - Default: `0`
- `closeness_score` (NUMERIC(null)) - Default: `0.0`
- `last_interaction` (BIGINT)
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_user_bot_room_relationships` - Columns: bot_id, room_id, user_platform_id
- `idx_usern_bot_room_summaries_lookup` - Columns: bot_id, room_id, user_platform_id
- `usern_and_bot_room_summaries_unique` (UNIQUE) - Columns: bot_id, room_id, user_platform_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`user_platform_id`, `bot_id`, `room_id`) (`usern_and_bot_room_summaries_unique`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`usern_and_bot_room_summaries_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`usern_and_bot_room_summaries_room_id_fkey`)

---

### 12. `user_room_summaries`

Stores user-specific summaries for a room.

**Columns:**
- `id` (UUID, NOT NULL, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_id` (UUID, NOT NULL)
- `room_id` (UUID, NOT NULL)
- `user_platform_id` (TEXT, NOT NULL)
- `user_display_name` (TEXT, NOT NULL)
- `summary` (JSONB) - Default: `'{}'::jsonb`
- `message_count` (INTEGER) - Default: `0`
- `last_seen` (BIGINT)
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_user_room_summaries_lookup` - Columns: bot_id, room_id, user_platform_id
- `user_room_summaries_unique` (UNIQUE) - Columns: bot_id, room_id, user_platform_id

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`bot_id`, `room_id`, `user_platform_id`) (`user_room_summaries_unique`)
- FOREIGN KEY: `bot_id` → `bots.id` ON DELETE CASCADE ON UPDATE NO ACTION (`user_room_summaries_bot_id_fkey`)
- FOREIGN KEY: `room_id` → `rooms.id` ON DELETE CASCADE ON UPDATE NO ACTION (`user_room_summaries_room_id_fkey`)

---

## Relationships

```
bots (1) ──< (many) analytics
rooms (1) ──< (many) analytics
bots (1) ──< (many) embeddings
rooms (1) ──< (many) embeddings
bots (1) ──< (many) events
rooms (1) ──< (many) events
bots (1) ──< (many) feature_flags
bots (1) ──< (many) response_threads
rooms (1) ──< (many) response_threads
bots (1) ──< (many) room_summaries
rooms (1) ──< (many) room_summaries
bots (1) ──< (many) user_and_bot_global_summaries
bots (1) ──< (many) user_and_bot_room_summaries
rooms (1) ──< (many) user_and_bot_room_summaries
bots (1) ──< (many) user_room_summaries
rooms (1) ──< (many) user_room_summaries
```

## Index Summary

### Performance-Critical Indexes

1. **`idx_bots_platform_id`** (bots) - Fast bot lookup by platform ID
2. **`idx_embeddings_bot_room`** (embeddings) - Composite index for embeddings queries by bot and room
3. **`idx_conversations_bot_room`** (events) - Composite index for events queries by bot and room
4. **`idx_conversations_timestamp`** (events) - Optimizes timestamp-based queries
5. **`idx_response_threads_bot_room`** (response_threads) - Composite index for response_threads queries by bot and room
6. **`idx_room_summaries_bot_room`** (room_summaries) - Composite index for room_summaries queries by bot and room
7. **`idx_rooms_room_id`** (rooms) - Fast room lookup by room ID
8. **`idx_user_bot_room_relationships`** (user_and_bot_room_summaries) - Composite index for user_and_bot_room_summaries queries by bot and room
9. **`idx_usern_bot_room_summaries_lookup`** (user_and_bot_room_summaries) - Composite index for user_and_bot_room_summaries queries by bot and room

## Data Types Reference

- **UUID** - Universally Unique Identifier (primary keys, foreign keys)
- **TEXT** - Variable-length text strings
- **JSONB** - Binary JSON data (indexed, queryable)
- **TIMESTAMPTZ** - Timestamp with timezone
- **TIMESTAMP** - Timestamp without timezone
- **BIGINT** - 64-bit integer
- **INTEGER** - 32-bit integer
- **NUMERIC** - Arbitrary precision numeric
- **BOOLEAN** - True/false values
- **USER-DEFINED** - Custom types (e.g., vector embeddings)

## Notes

- All tables have `created_at` and/or `updated_at` timestamps (auto-managed by Supabase)
- Foreign keys use `ON DELETE CASCADE` to maintain referential integrity
- Summary tables (`room_summaries`, `user_room_summaries`, etc.) are READ-ONLY from the application perspective (managed by external processes)
- The `events` table is the main data table storing all chat messages
- The `timestamp` column in `events` table uses BIGINT (Unix timestamp in milliseconds)
- Vector embeddings are stored in the `embeddings` table for semantic search capabilities

## Schema Verification Queries

To verify the current schema, run these queries in Supabase SQL Editor:

```sql
-- List all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Get all columns for a specific table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'events'
ORDER BY ordinal_position;

-- Get all indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Get all constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;
```
