# Script to generate SQL queries for listing tables
# These queries can be run in Supabase Dashboard SQL Editor or via psql

Write-Host "SQL Queries to List Database Tables" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Option 1: List all tables in public schema" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow
Write-Host ""
$query1 = @"
SELECT 
  tablename,
  tableowner,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"@
Write-Host $query1 -ForegroundColor White
Write-Host ""

Write-Host "Option 2: List tables with row counts and sizes" -ForegroundColor Yellow
Write-Host "------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
$query2 = @"
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = t.schemaname AND table_name = t.tablename) AS column_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"@
Write-Host $query2 -ForegroundColor White
Write-Host ""

Write-Host "Option 3: Detailed table information" -ForegroundColor Yellow
Write-Host "------------------------------------" -ForegroundColor Yellow
Write-Host ""
$query3 = @"
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
"@
Write-Host $query3 -ForegroundColor White
Write-Host ""

Write-Host "Option 4: List tables with their columns" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""
$query4 = @"
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
"@
Write-Host $query4 -ForegroundColor White
Write-Host ""

Write-Host "How to Run These Queries:" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Method 1: Supabase Dashboard" -ForegroundColor Yellow
Write-Host "1. Go to Supabase Dashboard → SQL Editor" -ForegroundColor White
Write-Host "2. Paste any of the queries above" -ForegroundColor White
Write-Host "3. Click Run" -ForegroundColor White
Write-Host ""
Write-Host "Method 2: Using psql (if installed)" -ForegroundColor Yellow
Write-Host "psql `"$($env:DATABASE_URL)`"" -ForegroundColor White
Write-Host "Then paste the SQL query" -ForegroundColor White
Write-Host ""
Write-Host "Method 3: Save query to file and run" -ForegroundColor Yellow
Write-Host "Save one of the queries above to a file (e.g., list_tables.sql)" -ForegroundColor White
Write-Host "Then: psql `"$($env:DATABASE_URL)`" -f list_tables.sql" -ForegroundColor White
Write-Host ""

# Try to save queries to files
Write-Host "Saving queries to files..." -ForegroundColor Yellow
$queriesDir = ".\sql_queries"
if (-not (Test-Path $queriesDir)) {
    New-Item -ItemType Directory -Path $queriesDir -Force | Out-Null
}

$query1 | Out-File -FilePath "$queriesDir\01_list_tables.sql" -Encoding UTF8
$query2 | Out-File -FilePath "$queriesDir\02_tables_with_sizes.sql" -Encoding UTF8
$query3 | Out-File -FilePath "$queriesDir\03_detailed_table_info.sql" -Encoding UTF8
$query4 | Out-File -FilePath "$queriesDir\04_tables_with_columns.sql" -Encoding UTF8

Write-Host "Queries saved to: $queriesDir\" -ForegroundColor Green
Write-Host "  - 01_list_tables.sql" -ForegroundColor White
Write-Host "  - 02_tables_with_sizes.sql" -ForegroundColor White
Write-Host "  - 03_detailed_table_info.sql" -ForegroundColor White
Write-Host "  - 04_tables_with_columns.sql" -ForegroundColor White
Write-Host ""

