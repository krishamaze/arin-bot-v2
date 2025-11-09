-- Complete Database Schema Inspection Query
-- Run this in Supabase Dashboard SQL Editor to inspect the current schema

-- 1. List all tables
SELECT 
  tablename,
  tableowner,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Table sizes and row counts
SELECT 
  t.tablename,
  pg_size_pretty(pg_total_relation_size('public.'||t.tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.'||t.tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size('public.'||t.tablename)) AS indexes_size,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.tablename) AS has_table
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||t.tablename) DESC;

-- 3. All indexes
SELECT
  t.tablename,
  i.indexname,
  i.indexdef,
  pg_size_pretty(pg_relation_size(i.indexname::regclass)) AS index_size
FROM pg_indexes i
JOIN pg_tables t ON i.tablename = t.tablename AND i.schemaname = t.schemaname
WHERE i.schemaname = 'public'
ORDER BY t.tablename, i.indexname;

-- 4. All constraints (primary keys, foreign keys, unique, check)
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5. Column details for key tables
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('bots', 'rooms', 'events', 'room_summaries', 
                     'user_room_summaries', 'user_and_bot_room_summaries', 
                     'user_and_bot_global_summaries')
ORDER BY table_name, ordinal_position;

