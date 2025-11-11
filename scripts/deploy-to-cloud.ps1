# Deploy to Supabase Cloud using .env file
# No browser login needed - uses SUPABASE_ACCESS_TOKEN from .env

param(
    [switch]$SkipMigration,
    [switch]$SkipFunctions
)

Write-Host "🚀 Supabase Cloud Deployment" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Load SUPABASE_ACCESS_TOKEN from .env
if (Test-Path .env) {
    Write-Host "📄 Loading SUPABASE_ACCESS_TOKEN from .env..." -ForegroundColor Yellow
    $env:SUPABASE_ACCESS_TOKEN = (Get-Content .env | Where-Object { $_ -match 'SUPABASE_ACCESS_TOKEN\s*=' } | ForEach-Object { 
        if ($_ -match '=\s*(.+)') { $matches[1].Trim() -replace '^["'']|["'']$', '' }
    })
    
    if ($env:SUPABASE_ACCESS_TOKEN) {
        Write-Host "✅ Token loaded" -ForegroundColor Green
    } else {
        Write-Host "❌ Error: SUPABASE_ACCESS_TOKEN not found in .env" -ForegroundColor Red
        Write-Host ""
        Write-Host "Add to .env file:" -ForegroundColor Yellow
        Write-Host "  SUPABASE_ACCESS_TOKEN=your_access_token" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Get token from: https://supabase.com/dashboard/account/tokens" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create .env file with:" -ForegroundColor Yellow
    Write-Host "  SUPABASE_ACCESS_TOKEN=your_access_token" -ForegroundColor Gray
    exit 1
}

$projectRef = "opaxtxfxropmjrrqlewh"

Write-Host ""
Write-Host "📋 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Project Ref: $projectRef" -ForegroundColor White
Write-Host "  Access Token: $($env:SUPABASE_ACCESS_TOKEN.Substring(0, [Math]::Min(20, $env:SUPABASE_ACCESS_TOKEN.Length)))..." -ForegroundColor White
Write-Host ""

# Step 1: Deploy Migrations
if (-not $SkipMigration) {
    Write-Host "📦 Step 1: Deploying Database Migrations..." -ForegroundColor Cyan
    Write-Host "-------------------------------------------" -ForegroundColor Cyan
    
    # Suppress Docker warnings for cloud deployment
    $env:SUPABASE_DOCKER_OVERRIDE = "false"
    $migrationResult = npx supabase db push --linked --include-all --yes 2>&1 | Where-Object { $_ -notmatch "WARNING: Docker" }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations deployed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration deployment failed" -ForegroundColor Red
        Write-Host $migrationResult
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping migrations (--SkipMigration flag set)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Deploy Edge Functions
if (-not $SkipFunctions) {
    Write-Host "⚡ Step 2: Deploying Edge Functions..." -ForegroundColor Cyan
    Write-Host "--------------------------------------" -ForegroundColor Cyan
    
    # List of functions to deploy
    $functions = @(
        "chat-api-v2",
        "wingman-profiles",
        "person-facts",
        "bot-persona",
        "generate-persona",
        "feedback-collector",
        "ml-optimizer"
    )
    
    # Suppress Docker warnings for cloud deployment
    $env:SUPABASE_DOCKER_OVERRIDE = "false"
    
    foreach ($functionName in $functions) {
        Write-Host "  Deploying $functionName..." -ForegroundColor Yellow
        $functionResult = npx supabase functions deploy $functionName --project-ref $projectRef 2>&1 | Where-Object { $_ -notmatch "WARNING: Docker" }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $functionName deployed successfully" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $functionName deployment failed" -ForegroundColor Red
            Write-Host $functionResult
            exit 1
        }
    }
    
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping functions (--SkipFunctions flag set)" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host ""

# Step 3: Verify Deployment
Write-Host "🔍 Step 3: Verifying Deployment..." -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

# Verify migrations
Write-Host "  Checking migrations..." -ForegroundColor Yellow
$migrationCheck = npx supabase migration list --linked 2>&1 | Where-Object { $_ -notmatch "WARNING: Docker" }
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Migrations verified" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Could not verify migrations (non-critical)" -ForegroundColor Yellow
}

# Verify functions
Write-Host "  Checking functions..." -ForegroundColor Yellow
$functionCheck = npx supabase functions list --project-ref $projectRef 2>&1 | Where-Object { $_ -notmatch "WARNING: Docker" }
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Functions verified" -ForegroundColor Green
    # Count active functions
    $activeCount = ($functionCheck | Select-String "ACTIVE").Count
    Write-Host "  📊 Active functions: $activeCount" -ForegroundColor White
} else {
    Write-Host "  ⚠️  Could not verify functions (non-critical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. View functions: https://supabase.com/dashboard/project/$projectRef/functions" -ForegroundColor White
Write-Host "  2. Check function logs: npx supabase functions logs chat-api-v2 --project-ref $projectRef" -ForegroundColor White
Write-Host ""

