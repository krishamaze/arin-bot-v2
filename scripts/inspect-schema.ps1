# Script to inspect Supabase database schema
# Queries tables, indexes, constraints, and column information

param(
    [string]$Query = "all"
)

Write-Host "Supabase Schema Inspection" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Load .env file
if (Test-Path ..\.env) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content ..\.env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} elseif (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "Error: DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

# Parse connection string
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $user = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "Connecting to: ${host}:${port}/${database}" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Error: Invalid DATABASE_URL format" -ForegroundColor Red
    exit 1
}

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "Error: psql not found. Please install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "Alternatively, use Supabase Dashboard SQL Editor to run these queries:" -ForegroundColor Yellow
    Write-Host ""
    
    # Output SQL queries for manual execution
    Write-Host "=== SQL Queries to Run ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. List all tables:" -ForegroundColor Yellow
    Get-Content ".\sql_queries\01_list_tables.sql" | Write-Host
    Write-Host ""
    Write-Host "2. Get table details with sizes:" -ForegroundColor Yellow
    Get-Content ".\sql_queries\02_tables_with_sizes.sql" | Write-Host
    Write-Host ""
    Write-Host "3. Get detailed table info:" -ForegroundColor Yellow
    Get-Content ".\sql_queries\03_detailed_table_info.sql" | Write-Host
    Write-Host ""
    Write-Host "4. Get table columns:" -ForegroundColor Yellow
    Get-Content ".\sql_queries\04_tables_with_columns.sql" | Write-Host
    Write-Host ""
    exit 1
}

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $password

# SQL queries
$queries = @{
    "tables" = @"
SELECT 
  tablename,
  tableowner,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"@
    "indexes" = @"
SELECT
    t.tablename,
    i.indexname,
    i.indexdef,
    pg_size_pretty(pg_relation_size(i.indexname::regclass)) AS index_size
FROM pg_indexes i
JOIN pg_tables t ON i.tablename = t.tablename AND i.schemaname = t.schemaname
WHERE i.schemaname = 'public'
ORDER BY t.tablename, i.indexname;
"@
    "constraints" = @"
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
"@
    "columns" = @"
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;
"@
    "sizes" = @"
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tablename) AS columns
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"@
}

if ($Query -eq "all" -or $Query -eq "tables") {
    Write-Host "=== TABLES ===" -ForegroundColor Cyan
    Write-Host ""
    $queries["tables"] | & $psqlPath.Path -h $host -p $port -U $user -d $database -t -A -F "|"
    Write-Host ""
}

if ($Query -eq "all" -or $Query -eq "indexes") {
    Write-Host "=== INDEXES ===" -ForegroundColor Cyan
    Write-Host ""
    $queries["indexes"] | & $psqlPath.Path -h $host -p $port -U $user -d $database -t -A
    Write-Host ""
}

if ($Query -eq "all" -or $Query -eq "constraints") {
    Write-Host "=== CONSTRAINTS ===" -ForegroundColor Cyan
    Write-Host ""
    $queries["constraints"] | & $psqlPath.Path -h $host -p $port -U $user -d $database -t -A
    Write-Host ""
}

if ($Query -eq "all" -or $Query -eq "columns") {
    Write-Host "=== COLUMNS ===" -ForegroundColor Cyan
    Write-Host ""
    $queries["columns"] | & $psqlPath.Path -h $host -p $port -U $user -d $database -t -A
    Write-Host ""
}

if ($Query -eq "all" -or $Query -eq "sizes") {
    Write-Host "=== TABLE SIZES ===" -ForegroundColor Cyan
    Write-Host ""
    $queries["sizes"] | & $psqlPath.Path -h $host -p $port -U $user -d $database -t -A
    Write-Host ""
}

# Cleanup
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "Inspection complete!" -ForegroundColor Green

