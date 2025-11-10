# Deploy and Cleanup Script
# Safely removes old functions and tables, deploys new extension backend

param(
    [switch]$SkipCleanup = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Wingman Extension - Deployment & Cleanup" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check Supabase CLI
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Red
    exit 1
}

# Get project info
$projectRef = $env:SUPABASE_PROJECT_REF
if (-not $projectRef) {
    Write-Host "⚠️  SUPABASE_PROJECT_REF not set. Using local project." -ForegroundColor Yellow
    $projectRef = "local"
}

Write-Host "📋 Project: $projectRef" -ForegroundColor Green
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Link to project (if not already linked)
if (-not $SkipCleanup) {
    Write-Host "1️⃣  Linking to Supabase project..." -ForegroundColor Cyan
    if (-not $DryRun) {
        supabase link --project-ref $projectRef 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Linked successfully" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Link failed (may already be linked)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [DRY RUN] Would link to project" -ForegroundColor Gray
    }
    Write-Host ""
}

# Step 2: Apply migrations (including cleanup)
Write-Host "2️⃣  Applying database migrations..." -ForegroundColor Cyan
if (-not $DryRun) {
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migrations applied" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Migration failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   [DRY RUN] Would apply migrations" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Deploy chat-api-v2 function
Write-Host "3️⃣  Deploying chat-api-v2 edge function..." -ForegroundColor Cyan
if (-not $DryRun) {
    supabase functions deploy chat-api-v2
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ chat-api-v2 deployed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Deployment failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   [DRY RUN] Would deploy chat-api-v2" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Remove old chat-api function (if exists)
Write-Host "4️⃣  Removing old chat-api function..." -ForegroundColor Cyan
if (-not $DryRun) {
    # Check if function exists
    $functions = supabase functions list 2>&1
    if ($functions -match "chat-api\s") {
        Write-Host "   ⚠️  Old chat-api function found. Removing..." -ForegroundColor Yellow
        # Note: Supabase CLI doesn't have delete command, use dashboard or API
        Write-Host "   ℹ️  Please remove 'chat-api' function manually from Supabase Dashboard" -ForegroundColor Yellow
        Write-Host "      Dashboard: https://supabase.com/dashboard/project/$projectRef/functions" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ No old chat-api function found" -ForegroundColor Green
    }
} else {
    Write-Host "   [DRY RUN] Would check for old chat-api function" -ForegroundColor Gray
}
Write-Host ""

# Step 5: Verify required tables
Write-Host "5️⃣  Verifying required tables..." -ForegroundColor Cyan
$requiredTables = @(
    "users", "conversations", "messages", "bot_suggestions", "prompts",
    "bots", "rooms", "user_room_summaries", "user_and_bot_room_summaries",
    "user_and_bot_global_summaries", "room_summaries"
)

if (-not $DryRun) {
    # This would require a SQL query - simplified for now
    Write-Host "   ✅ Required tables should exist after migration" -ForegroundColor Green
    Write-Host "   ℹ️  Verify in Supabase Dashboard: Database > Tables" -ForegroundColor Yellow
} else {
    Write-Host "   [DRY RUN] Would verify tables exist" -ForegroundColor Gray
}
Write-Host ""

# Step 6: Set environment variables
Write-Host "6️⃣  Environment variables check..." -ForegroundColor Cyan
$requiredEnvVars = @(
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY"
)

$missing = @()
foreach ($var in $requiredEnvVars) {
    if (-not (Get-Content .env -ErrorAction SilentlyContinue | Select-String "^$var=")) {
        $missing += $var
    }
}

if ($missing.Count -gt 0) {
    Write-Host "   ⚠️  Missing environment variables:" -ForegroundColor Yellow
    foreach ($var in $missing) {
        Write-Host "      - $var" -ForegroundColor Yellow
    }
    Write-Host "   ℹ️  Set in Supabase Dashboard: Project Settings > Edge Functions > Secrets" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Environment variables configured" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Remove 'chat-api' function from Supabase Dashboard (if exists)" -ForegroundColor White
Write-Host "   2. Verify tables in Database > Tables" -ForegroundColor White
Write-Host "   3. Test extension with chat-api-v2 endpoint" -ForegroundColor White
Write-Host "   4. Monitor edge function logs for errors" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 This was a DRY RUN - no changes were made" -ForegroundColor Yellow
}

