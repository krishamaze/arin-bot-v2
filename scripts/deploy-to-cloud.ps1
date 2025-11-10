# Deploy Wingman Extension to Supabase Cloud
# This script safely deploys the new extension backend and cleans up old resources

param(
    [string]$ProjectRef = "",
    [switch]$SkipCleanup = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Wingman Extension - Cloud Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Supabase CLI
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "Supabase CLI not found!" -ForegroundColor Red
    Write-Host "   Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

$cliVersion = supabase --version
Write-Host "Supabase CLI: $cliVersion" -ForegroundColor Green
Write-Host ""

# Get project ref
if (-not $ProjectRef) {
    $ProjectRef = $env:SUPABASE_PROJECT_REF
    if (-not $ProjectRef) {
        Write-Host "Project ref not provided" -ForegroundColor Yellow
        Write-Host "   Set SUPABASE_PROJECT_REF environment variable" -ForegroundColor Yellow
        Write-Host "   Or use: .\scripts\deploy-to-cloud.ps1 -ProjectRef YOUR_REF" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Project Ref: $ProjectRef" -ForegroundColor Green
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Link project
Write-Host "1. Linking to Supabase project..." -ForegroundColor Cyan
if (-not $DryRun) {
    $linkOutput = supabase link --project-ref $ProjectRef 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Linked successfully" -ForegroundColor Green
    } else {
        Write-Host "   May already be linked, continuing..." -ForegroundColor Yellow
    }
} else {
    Write-Host "   [DRY RUN] Would link to project" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Deploy migrations
Write-Host "2. Deploying database migrations..." -ForegroundColor Cyan
Write-Host "   This includes:" -ForegroundColor Gray
Write-Host "   - prompts table (new)" -ForegroundColor Gray
Write-Host "   - cleanup of unused tables" -ForegroundColor Gray
Write-Host ""

if (-not $DryRun) {
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Migrations deployed" -ForegroundColor Green
    } else {
        Write-Host "   Migration failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   [DRY RUN] Would deploy migrations" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Deploy chat-api-v2 function
Write-Host "3. Deploying chat-api-v2 edge function..." -ForegroundColor Cyan
if (-not $DryRun) {
    supabase functions deploy chat-api-v2
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   chat-api-v2 deployed" -ForegroundColor Green
    } else {
        Write-Host "   Deployment failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   [DRY RUN] Would deploy chat-api-v2" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Verify environment variables
Write-Host "4. Checking environment variables..." -ForegroundColor Cyan
Write-Host "   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY" -ForegroundColor Gray
Write-Host "   Optional: PROMPT_SOURCE, PROMPT_VERSION" -ForegroundColor Gray
Write-Host "   Set in Dashboard: Project Settings > Edge Functions > Secrets" -ForegroundColor Yellow
Write-Host ""

# Step 5: Instructions for cleanup
Write-Host "5. Manual cleanup required:" -ForegroundColor Cyan
Write-Host "   Remove old 'chat-api' function from Dashboard:" -ForegroundColor Yellow
Write-Host "   https://supabase.com/dashboard/project/$ProjectRef/functions" -ForegroundColor Cyan
Write-Host "   Supabase CLI doesn't support function deletion" -ForegroundColor Gray
Write-Host ""

# Summary
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   1. Remove 'chat-api' function from Dashboard (if exists)" -ForegroundColor White
Write-Host "   2. Verify tables in Database > Tables" -ForegroundColor White
Write-Host "   3. Test extension with chat-api-v2 endpoint" -ForegroundColor White
Write-Host "   4. Monitor logs: supabase functions logs chat-api-v2" -ForegroundColor White
Write-Host ""
Write-Host "Dashboard: https://supabase.com/dashboard/project/$ProjectRef" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN - no changes were made" -ForegroundColor Yellow
}
