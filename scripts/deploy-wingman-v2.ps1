# Deployment script for Wingman chat-api-v2
param(
    [switch]$SkipMigration = $false,
    [switch]$SkipFunction = $false,
    [switch]$DryRun = $false
)

Write-Host "Wingman v2 Deployment Script" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseInstalled) {
    Write-Host "❌ ERROR: Supabase CLI not found" -ForegroundColor Red
    Write-Host "Please install Supabase CLI: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "supabase/migrations/20251109000000_wingman_schema.sql")) {
    Write-Host "❌ ERROR: Migration file not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

# Check if chat-api-v2 function exists
if (-not (Test-Path "supabase/functions/chat-api-v2/index.ts")) {
    Write-Host "❌ ERROR: chat-api-v2 function not found" -ForegroundColor Red
    Write-Host "Please ensure the function is created before deploying" -ForegroundColor Yellow
    exit 1
}

Write-Host "Pre-deployment checklist:" -ForegroundColor Yellow
Write-Host "✅ Supabase CLI installed" -ForegroundColor Green
Write-Host "✅ Migration file exists" -ForegroundColor Green
Write-Host "✅ Edge function exists" -ForegroundColor Green
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Deploy Migration
if (-not $SkipMigration) {
    Write-Host "Step 1: Deploying Database Migration" -ForegroundColor Cyan
    Write-Host "-------------------------------------" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "Would run: supabase db push" -ForegroundColor Gray
    } else {
        Write-Host "Running: supabase db push" -ForegroundColor Gray
        Write-Host ""
        
        try {
            $output = supabase db push 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Migration deployed successfully" -ForegroundColor Green
            } else {
                Write-Host "❌ Migration failed" -ForegroundColor Red
                Write-Host $output
                exit 1
            }
        } catch {
            Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping migration deployment" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Deploy Edge Function
if (-not $SkipFunction) {
    Write-Host "Step 2: Deploying Edge Function" -ForegroundColor Cyan
    Write-Host "-------------------------------" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "Would run: supabase functions deploy chat-api-v2" -ForegroundColor Gray
    } else {
        Write-Host "Running: supabase functions deploy chat-api-v2" -ForegroundColor Gray
        Write-Host ""
        
        try {
            $output = supabase functions deploy chat-api-v2 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Edge function deployed successfully" -ForegroundColor Green
                Write-Host $output
            } else {
                Write-Host "❌ Deployment failed" -ForegroundColor Red
                Write-Host $output
                exit 1
            }
        } catch {
            Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping function deployment" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Verify Deployment
if (-not $DryRun) {
    Write-Host "Step 3: Verifying Deployment" -ForegroundColor Cyan
    Write-Host "----------------------------" -ForegroundColor Cyan
    
    Write-Host "Checking function status..." -ForegroundColor Gray
    try {
        $functions = supabase functions list 2>&1
        if ($functions -match "chat-api-v2") {
            Write-Host "✅ Function chat-api-v2 is listed" -ForegroundColor Green
        } else {
            Write-Host "⚠️  WARNING: Function not found in list" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  WARNING: Could not verify function status" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test the /init endpoint: .\scripts\test-wingman-v2.ps1 -TestInit" -ForegroundColor White
Write-Host "2. Test the analysis endpoint: .\scripts\test-wingman-v2.ps1 -TestAnalysis" -ForegroundColor White
Write-Host "3. Test the Chrome extension with the new endpoint" -ForegroundColor White
Write-Host "4. Monitor function logs in Supabase Dashboard" -ForegroundColor White

