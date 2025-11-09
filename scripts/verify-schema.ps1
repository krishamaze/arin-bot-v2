# Script to verify Supabase database schema alignment
# This script helps verify schema using database connection from .env

param(
    [switch]$PullSchema,
    [switch]$DiffSchema
)

Write-Host "Supabase Schema Verification Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Use local Supabase CLI from virtual environment
function Invoke-Supabase {
    param([string[]]$Arguments)
    & npx --prefix ..\.venv_supabase supabase @Arguments
    return $LASTEXITCODE
}

# Load .env file if it exists
if (Test-Path .env) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
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
    Write-Host ""
    Write-Host "Please create a .env file with your database connection string:" -ForegroundColor Yellow
    Write-Host "  DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[HOST]:[PORT]/postgres" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  DATABASE_URL=postgresql://postgres.abc123xyz:your_password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" -ForegroundColor Gray
    exit 1
}

# Check for database URL (try multiple common variable names)
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    $dbUrl = $env:SUPABASE_DB_URL
}
if (-not $dbUrl) {
    $dbUrl = $env:SUPABASE_URL
}
if (-not $dbUrl) {
    Write-Host "Error: Database URL not found in .env" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add one of these to your .env file:" -ForegroundColor Yellow
    Write-Host "  DATABASE_URL=postgresql://..." -ForegroundColor Gray
    Write-Host "  SUPABASE_DB_URL=postgresql://..." -ForegroundColor Gray
    Write-Host "  SUPABASE_URL=postgresql://..." -ForegroundColor Gray
    exit 1
}

# Mask password in display
$displayUrl = $dbUrl -replace ':[^:@]+@', ':****@'
Write-Host "Database URL found: $displayUrl" -ForegroundColor Green
Write-Host ""

# For Supabase CLI, we need to pass the connection string as-is
# The CLI handles URL encoding internally, but we may need to escape special characters in PowerShell
# Pass the raw URL - Supabase CLI will handle encoding if needed
$encodedUrl = $dbUrl

Write-Host "Note: Supabase CLI commands (db pull, db diff) require Docker Desktop" -ForegroundColor Yellow
Write-Host "for shadow database operations, even when using --db-url flag." -ForegroundColor Yellow
Write-Host ""

if ($PullSchema) {
    Write-Host "Pulling schema from remote database..." -ForegroundColor Cyan
    Write-Host "Command: npx --prefix ..\.venv_supabase supabase db pull --db-url `"<encoded-url>`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "This will create migration files in supabase/migrations/" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to run the command
    try {
        $exitCode = Invoke-Supabase -Arguments @("db", "pull", "--db-url", $encodedUrl)
        if ($exitCode -eq 0) {
            Write-Host ""
            Write-Host "Schema pulled successfully!" -ForegroundColor Green
        } else {
            Write-Host "Command failed. Check if Docker Desktop is running." -ForegroundColor Red
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} elseif ($DiffSchema) {
    Write-Host "Comparing local migrations with remote database schema..." -ForegroundColor Cyan
    Write-Host "Command: npx --prefix ..\.venv_supabase supabase db diff --db-url `"<encoded-url>`"" -ForegroundColor Gray
    Write-Host ""
    
    # Check if migrations exist
    if (Test-Path "..\supabase\migrations") {
        $migrationCount = (Get-ChildItem "..\supabase\migrations\*.sql" -ErrorAction SilentlyContinue).Count
        Write-Host "Found $migrationCount migration file(s)" -ForegroundColor Yellow
    } else {
        Write-Host "Warning: No migrations directory found. Run with -PullSchema first." -ForegroundColor Yellow
    }
    
    Write-Host ""
    try {
        $exitCode = Invoke-Supabase -Arguments @("db", "diff", "--db-url", $encodedUrl)
        if ($exitCode -eq 0) {
            Write-Host ""
            Write-Host "Schema comparison completed!" -ForegroundColor Green
        } else {
            Write-Host "Command failed. Check if Docker Desktop is running." -ForegroundColor Red
        }
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Usage options:" -ForegroundColor Cyan
    Write-Host "  .\verify-schema.ps1 -PullSchema   # Pull schema from remote and create migrations" -ForegroundColor White
    Write-Host "  .\verify-schema.ps1 -DiffSchema   # Compare local migrations with remote schema" -ForegroundColor White
    Write-Host ""
    Write-Host "Manual commands:" -ForegroundColor Cyan
    Write-Host "  # Pull schema:" -ForegroundColor Yellow
    Write-Host "  `$env:DATABASE_URL=`"$displayUrl`"" -ForegroundColor Gray
    Write-Host "  npx --prefix ..\.venv_supabase supabase db pull --db-url `$env:DATABASE_URL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # Compare schemas:" -ForegroundColor Yellow
    Write-Host "  npx --prefix ..\.venv_supabase supabase db diff --db-url `$env:DATABASE_URL" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Important: Docker Desktop must be running for these commands to work." -ForegroundColor Yellow
}
