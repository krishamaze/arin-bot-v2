SELECT 
  tablename,
  tableowner,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
