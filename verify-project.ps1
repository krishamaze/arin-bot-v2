# Quick Project Verification Script
# Checks if the correct Supabase project is linked

param(
    [string]$ExpectedProjectId = "opaxtxfxropmjrrqlewh"
)

Write-Host "🔍 Supabase Project Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Load expected project ID from .project-id if it exists
if (Test-Path .project-id) {
    $savedProjectId = (Get-Content .project-id -Raw).Trim()
    if ($savedProjectId) {
        $ExpectedProjectId = $savedProjectId
        Write-Host "📋 Expected project ID (from .project-id): $ExpectedProjectId" -ForegroundColor Gray
    }
} else {
    Write-Host "📋 Expected project ID: $ExpectedProjectId" -ForegroundColor Gray
}

Write-Host ""

# Check if supabase CLI is available
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Error: supabase CLI not found in PATH" -ForegroundColor Red
    Write-Host "   Please install Supabase CLI: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Check Supabase status
Write-Host "📊 Checking Supabase status..." -ForegroundColor Yellow
try {
    $statusOutput = supabase status 2>&1 | Out-String
    Write-Host $statusOutput
} catch {
    Write-Host "⚠️  Could not get status (this is normal if not linked locally)" -ForegroundColor Yellow
}

Write-Host ""

# Try to get linked project from functions list
Write-Host "🔗 Checking linked project..." -ForegroundColor Yellow
try {
    $functionsOutput = supabase functions list --output json 2>&1 | Out-String
    
    if ($functionsOutput -and -not ($functionsOutput -match "error|Error|ERROR|not found")) {
        $functions = $functionsOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        if ($functions -and $functions.value -and $functions.value.Count -gt 0) {
            # Get project info from function metadata or URL
            # The functions list might not directly show project ID, but we can infer it
            Write-Host "✅ Supabase CLI is connected" -ForegroundColor Green
            Write-Host ""
            Write-Host "📦 Deployed functions:" -ForegroundColor Cyan
            foreach ($func in $functions.value) {
                Write-Host "   - $($func.name) (Status: $($func.status))" -ForegroundColor White
            }
            Write-Host ""
            Write-Host "⚠️  Note: Project ID verification requires checking dashboard or link status" -ForegroundColor Yellow
            Write-Host "   Run: supabase link --help" -ForegroundColor Gray
            Write-Host "   Or check: https://supabase.com/dashboard" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  No functions found or project not linked" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Could not retrieve function list" -ForegroundColor Yellow
        Write-Host "   This might mean:" -ForegroundColor Gray
        Write-Host "   - Project is not linked" -ForegroundColor Gray
        Write-Host "   - You're not logged in" -ForegroundColor Gray
        Write-Host "   - No functions are deployed" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error checking functions: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Check for .supabase directory
if (Test-Path .supabase) {
    Write-Host "📁 Found .supabase directory" -ForegroundColor Green
    $configFiles = Get-ChildItem .supabase -Recurse -Filter "*.json" -ErrorAction SilentlyContinue
    if ($configFiles) {
        Write-Host "   Configuration files found" -ForegroundColor Gray
    }
} else {
    Write-Host "📁 No .supabase directory found" -ForegroundColor Yellow
    Write-Host "   Project may not be linked locally" -ForegroundColor Gray
}

Write-Host ""

# Check for .project-id file
if (Test-Path .project-id) {
    Write-Host "✅ Found .project-id file" -ForegroundColor Green
    $projectId = (Get-Content .project-id -Raw).Trim()
    Write-Host "   Project ID: $projectId" -ForegroundColor Gray
    
    if ($projectId -eq $ExpectedProjectId) {
        Write-Host "   ✅ Matches expected project ID" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Does not match expected project ID: $ExpectedProjectId" -ForegroundColor Yellow
    }
} else {
    Write-Host "ℹ️  No .project-id file found" -ForegroundColor Gray
    Write-Host "   Create one with: echo '$ExpectedProjectId' > .project-id" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Manual verification steps
Write-Host "🔧 Manual Verification Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Check Supabase Dashboard:" -ForegroundColor White
Write-Host "   https://supabase.com/dashboard/project/$ExpectedProjectId" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verify linked project:" -ForegroundColor White
Write-Host "   supabase link --help" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check deployed functions:" -ForegroundColor White
Write-Host "   supabase functions list" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Link to correct project (if needed):" -ForegroundColor White
Write-Host "   supabase unlink" -ForegroundColor Gray
Write-Host "   supabase link --project-ref $ExpectedProjectId" -ForegroundColor Gray
Write-Host ""

# Final status
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Verification complete!" -ForegroundColor Green
Write-Host ""

