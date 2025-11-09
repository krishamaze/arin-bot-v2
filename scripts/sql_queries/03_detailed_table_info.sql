SELECT 
  t.tablename,
  obj_description(c.oid, 'pg_class') AS table_comment,
  pg_size_pretty(pg_total_relation_size('public.'||t.tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.'||t.tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size('public.'||t.tablename)) AS indexes_size,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tablename) AS columns
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
