# Database Tables Reference

This document lists the tables used in the arin-bot-v2 project based on codebase analysis.

## Tables Used in Codebase

Based on the Edge Functions code, the following tables are used:

### 1. `bots`
**Purpose**: Stores bot information and personalities

**Columns used:**
- `id` (UUID)
- `platform_id` (string)
- `username` (string)
- `personality` (text)
- `config` (JSON)

**Queries:**
- Select by platform_id
- Upsert (create or update)

### 2. `rooms`
**Purpose**: Stores room/chat room information

**Columns used:**
- `id` (UUID)
- `room_id` (string/path)

**Queries:**
- Select by room_id
- Insert (create if doesn't exist)

### 3. `events`
**Purpose**: Stores chat events/messages

**Columns used:**
- `bot_id` (UUID, foreign key to bots)
- `room_id` (UUID, foreign key to rooms)
- `user_platform_id` (string)
- `user_display_name` (string)
- `message_text` (text)
- `message_type` (string, e.g., 'message', 'quoted')
- `timestamp` (timestamptz)
- `metadata` (JSON)
  - `quoted_message` (text)
  - `quoted_user` (string)
  - `quoted_platform_id` (string)

**Queries:**
- Select last 50 messages by bot_id and room_id
- Insert event records

### 4. `room_summaries`
**Purpose**: Stores room-level conversation summaries

**Columns used:**
- `bot_id` (UUID)
- `room_id` (UUID)
- Other columns (structure inferred from select *)

**Queries:**
- Select by bot_id and room_id

### 5. `user_room_summaries`
**Purpose**: Stores user-specific summaries for a room

**Columns used:**
- `bot_id` (UUID)
- `room_id` (UUID)
- `user_platform_id` (string)
- Other columns (structure inferred from select *)

**Queries:**
- Select by bot_id, room_id, and user_platform_id (IN clause)

### 6. `user_and_bot_room_summaries`
**Purpose**: Stores summaries combining user and bot interactions in a room

**Columns used:**
- `bot_id` (UUID)
- `room_id` (UUID)
- `user_platform_id` (string)
- Other columns (structure inferred from select *)

**Queries:**
- Select by bot_id, room_id, and user_platform_id (IN clause)

### 7. `user_and_bot_global_summaries`
**Purpose**: Stores global summaries of user and bot interactions across all rooms

**Columns used:**
- `bot_id` (UUID)
- `user_platform_id` (string)
- Other columns (structure inferred from select *)

**Queries:**
- Select by bot_id and user_platform_id (IN clause)

### 8. `bot_configs` (mentioned in backup files)
**Purpose**: Stores bot configuration per room

**Columns used:**
- `room_id` (string)
- `platform_id` (string)

**Queries:**
- Select by room_id and platform_id
- Upsert (create or update)

## SQL Queries to Check Tables

### List All Tables

```sql
SELECT 
  tablename,
  tableowner,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Get Table Details with Sizes

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT count(*) FROM information_schema.columns 
   WHERE table_schema = t.schemaname AND table_name = t.tablename) AS column_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Get Columns for Specific Tables

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('bots', 'rooms', 'events', 'room_summaries', 
                     'user_room_summaries', 'user_and_bot_room_summaries', 
                     'user_and_bot_global_summaries', 'bot_configs')
ORDER BY table_name, ordinal_position;
```

## How to Check Tables

### Method 1: Supabase Dashboard
1. Go to Supabase Dashboard → Table Editor
2. View all tables listed
3. Click on each table to see structure and data

### Method 2: SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Run one of the SQL queries above
3. View results

### Method 3: Using Scripts
```powershell
# Generate SQL queries
.\list-tables-sql.ps1

# Run queries from saved files
# Then use Supabase Dashboard SQL Editor or psql
```

### Method 4: Using Supabase CLI (after fixing password)
```bash
# Link project first
supabase link --project-ref opaxtxfxropmjrrqlewh

# Pull schema to see tables
supabase db pull

# Check table stats
supabase inspect db table-stats --linked
```

## Next Steps

1. **Fix Database Connection**: Update password in `.env` file
2. **Pull Schema**: Use `supabase db pull` to get current schema
3. **Generate Types**: Create TypeScript types from schema
4. **Verify Tables**: Check that all tables exist and match expected structure

## Notes

- Tables 4-7 appear to be views or materialized views (based on naming pattern)
- The `events` table is the main data table storing chat messages
- The `bots` and `rooms` tables are reference tables
- Summary tables (room_summaries, user_room_summaries, etc.) are likely generated/updated by other processes

