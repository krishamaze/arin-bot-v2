-- Verification queries for database optimization
-- Run these queries after applying the migration to verify indexes and constraints were created

-- 1. Verify all indexes were created
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. Verify constraints were created
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 3. Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 4. Check table sizes and index overhead
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size('public.'||tablename)) AS indexes_size,
  ROUND(100.0 * pg_indexes_size('public.'||tablename) / NULLIF(pg_total_relation_size('public.'||tablename), 0), 2) AS index_overhead_pct
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- 5. Check for NULL values in columns that should be NOT NULL
SELECT 
  'bots' AS table_name,
  COUNT(*) FILTER (WHERE platform_id IS NULL) AS platform_id_nulls,
  COUNT(*) FILTER (WHERE username IS NULL) AS username_nulls
FROM bots
UNION ALL
SELECT 
  'rooms' AS table_name,
  COUNT(*) FILTER (WHERE room_id IS NULL) AS room_id_nulls,
  0 AS username_nulls
FROM rooms
UNION ALL
SELECT 
  'events' AS table_name,
  COUNT(*) FILTER (WHERE bot_id IS NULL) AS bot_id_nulls,
  COUNT(*) FILTER (WHERE room_id IS NULL) AS room_id_nulls
FROM events;

-- 6. Check index usage statistics (run after some queries have been executed)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

