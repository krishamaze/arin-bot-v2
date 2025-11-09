# Script to list tables from Supabase database using DATABASE_URL from .env
Write-Host "Listing Tables from Supabase Database" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Use local Supabase CLI from virtual environment
function Invoke-Supabase {
    param([string[]]$Arguments)
    & npx --prefix ..\.venv_supabase supabase @Arguments
    return $LASTEXITCODE
}

# Load .env file
if (Test-Path .env) {
    Write-Host "Loading .env file..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Environment variables loaded." -ForegroundColor Green
} else {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    exit 1
}

$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "Error: DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

# Mask password for display
$displayUrl = $dbUrl -replace ':[^:@]+@', ':****@'
Write-Host "Database: $displayUrl" -ForegroundColor Green
Write-Host ""

# Extract connection details for SQL query
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $user = $matches[1]
    $password = $matches[2]
    $dbHost = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "Connection Details:" -ForegroundColor Cyan
    Write-Host "  Host: $dbHost" -ForegroundColor White
    Write-Host "  Port: $port" -ForegroundColor White
    Write-Host "  Database: $database" -ForegroundColor White
    Write-Host "  User: $user" -ForegroundColor White
    Write-Host ""
}

Write-Host "Querying database for tables..." -ForegroundColor Yellow
Write-Host ""

# Try using Supabase CLI to inspect database
try {
    Write-Host "Method 1: Using Supabase CLI inspect..." -ForegroundColor Cyan
    
    # Use db pull with schema only to see tables
    # Or use inspect commands if available
    $result = Invoke-Supabase -Arguments @("inspect", "db", "table-stats", "--db-url", $dbUrl) 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host $result
        exit 0
    } else {
        Write-Host "CLI inspect not available or requires Docker. Trying alternative method..." -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    Write-Host "CLI method failed. Trying alternative..." -ForegroundColor Yellow
    Write-Host ""
}

# Alternative: Use psql if available, or provide SQL query
Write-Host "Method 2: SQL Query to list tables" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this SQL query to list all tables:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT" -ForegroundColor White
Write-Host "  schemaname," -ForegroundColor White
Write-Host "  tablename," -ForegroundColor White
Write-Host "  tableowner" -ForegroundColor White
Write-Host "FROM pg_tables" -ForegroundColor White
Write-Host "WHERE schemaname NOT IN ('pg_catalog', 'information_schema')" -ForegroundColor White
Write-Host "ORDER BY schemaname, tablename;" -ForegroundColor White
Write-Host ""

Write-Host "Or use this to get table details with row counts:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT" -ForegroundColor White
Write-Host "  schemaname," -ForegroundColor White
Write-Host "  tablename," -ForegroundColor White
Write-Host "  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size" -ForegroundColor White
Write-Host "FROM pg_tables" -ForegroundColor White
Write-Host "WHERE schemaname = 'public'" -ForegroundColor White
Write-Host "ORDER BY tablename;" -ForegroundColor White
Write-Host ""

# Try to use supabase db pull to see schema
Write-Host "Method 3: Using db pull to inspect schema..." -ForegroundColor Cyan
Write-Host ""

try {
    # Create a temporary directory for pull
    $tempDir = ".\temp_schema_check"
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Try to pull schema (this will show tables even if it fails partially)
    Write-Host "Attempting to pull schema structure..." -ForegroundColor Yellow
    $pullResult = Invoke-Supabase -Arguments @("db", "pull", "--db-url", $dbUrl, "--schema", "public") 2>&1 | Out-String
    
    if ($pullResult -match 'table|TABLE|CREATE TABLE') {
        Write-Host "Schema information found:" -ForegroundColor Green
        Write-Host $pullResult
    } else {
        Write-Host "Could not extract table information from db pull." -ForegroundColor Yellow
        Write-Host $pullResult
    }
    
    # Cleanup
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "Could not pull schema: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: For best results, ensure:" -ForegroundColor Yellow
Write-Host "1. DATABASE_URL password is correct in .env" -ForegroundColor White
Write-Host "2. Docker Desktop is running (for some CLI operations)" -ForegroundColor White
Write-Host "3. Or use Supabase Dashboard → Table Editor to view tables" -ForegroundColor White

