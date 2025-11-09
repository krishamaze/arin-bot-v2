# Simple Supabase Connection Test Script
Write-Host "Supabase Remote Connection Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
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
Write-Host "Connection String: $displayUrl" -ForegroundColor Green
Write-Host ""

# Extract connection details
if ($dbUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $user = $matches[1]
    $password = $matches[2]
    $dbHost = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    Write-Host "Connection Details:" -ForegroundColor Cyan
    Write-Host "  Host: $dbHost" -ForegroundColor White
    Write-Host "  Port: $port" -ForegroundColor White
    Write-Host "  User: $user" -ForegroundColor White
    Write-Host "  Database: $database" -ForegroundColor White
    Write-Host "  Password: **** (length: $($password.Length))" -ForegroundColor White
    Write-Host ""
}

# Test connection using supabase CLI
Write-Host "Testing connection with Supabase CLI..." -ForegroundColor Yellow
Write-Host ""

try {
    # Try a simple db pull command
    $result = Invoke-Supabase -Arguments @("db", "pull", "--db-url", $dbUrl, "--debug") 2>&1
    $output = $result | Out-String
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "✅ Connection successful!" -ForegroundColor Green
        Write-Host $output
    } else {
        Write-Host "❌ Connection failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error output:" -ForegroundColor Yellow
        Write-Host $output
        
        # Parse common errors
        if ($output -match 'password authentication failed') {
            Write-Host ""
            Write-Host "⚠️  Password authentication failed" -ForegroundColor Red
            Write-Host "   Possible causes:" -ForegroundColor Yellow
            Write-Host "   1. Incorrect password in .env file" -ForegroundColor White
            Write-Host "   2. Password contains special characters that need encoding" -ForegroundColor White
            Write-Host "   3. Database password was reset in Supabase Dashboard" -ForegroundColor White
            Write-Host ""
            Write-Host "   Solution:" -ForegroundColor Cyan
            Write-Host "   - Check Supabase Dashboard → Settings → Database" -ForegroundColor White
            Write-Host "   - Copy the connection string and verify the password" -ForegroundColor White
            Write-Host "   - If password has special characters (@, #, $, %, etc.), URL encode them:" -ForegroundColor White
            Write-Host "     @ → %40, # → %23, $ → %24, % → %25" -ForegroundColor Gray
        }
        
        if ($output -match 'Docker Desktop') {
            Write-Host ""
            Write-Host "⚠️  Docker Desktop is required for schema operations" -ForegroundColor Yellow
            Write-Host "   Docker Desktop must be running for db pull/diff commands" -ForegroundColor White
        }
    }
} catch {
    Write-Host "Error running test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Connection Test Complete" -ForegroundColor Cyan

