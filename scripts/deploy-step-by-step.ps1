# Step-by-step deployment guide for Wingman
param(
    [switch]$Step1,
    [switch]$Step2,
    [switch]$Step3,
    [switch]$Step4,
    [switch]$Step5,
    [switch]$All
)

Write-Host "Wingman Deployment - Step by Step" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$projectRef = "opaxtxfxropmjrrqlewh"

# Step 1: Login to Supabase
if ($Step1 -or $All) {
    Write-Host "Step 1: Login to Supabase" -ForegroundColor Yellow
    Write-Host "------------------------" -ForegroundColor Yellow
    Write-Host "This will open a browser window for authentication." -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Press Enter to continue with login, or 's' to skip"
    if ($response -ne 's') {
        Write-Host "Running: supabase login" -ForegroundColor Gray
        supabase login
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Login successful" -ForegroundColor Green
        } else {
            Write-Host "❌ Login failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping login" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 2: Link Project
if ($Step2 -or $All) {
    Write-Host "Step 2: Link to Supabase Project" -ForegroundColor Yellow
    Write-Host "--------------------------------" -ForegroundColor Yellow
    Write-Host "Project Reference: $projectRef" -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Press Enter to continue with linking, or 's' to skip"
    if ($response -ne 's') {
        Write-Host "Running: supabase link --project-ref $projectRef" -ForegroundColor Gray
        supabase link --project-ref $projectRef
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Project linked successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Project linking failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping project linking" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 3: Deploy Migration
if ($Step3 -or $All) {
    Write-Host "Step 3: Deploy Database Migration" -ForegroundColor Yellow
    Write-Host "----------------------------------" -ForegroundColor Yellow
    Write-Host "This will create the Wingman schema in the database." -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Press Enter to continue with migration, or 's' to skip"
    if ($response -ne 's') {
        Write-Host "Running: supabase db push" -ForegroundColor Gray
        Write-Host ""
        supabase db push
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration deployed successfully" -ForegroundColor Green
            
            # Verify schema
            Write-Host ""
            Write-Host "Verifying schema..." -ForegroundColor Gray
            .\scripts\verify-wingman-schema.ps1
        } else {
            Write-Host ""
            Write-Host "❌ Migration deployment failed" -ForegroundColor Red
            Write-Host "Please check the error messages above" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping migration deployment" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 4: Deploy Edge Function
if ($Step4 -or $All) {
    Write-Host "Step 4: Deploy Edge Function" -ForegroundColor Yellow
    Write-Host "---------------------------" -ForegroundColor Yellow
    Write-Host "This will deploy the chat-api-v2 function." -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Make sure GEMINI_API_KEY is set in Supabase Dashboard" -ForegroundColor Yellow
    Write-Host "   Project Settings → Edge Functions → Environment Variables" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "Press Enter to continue with function deployment, or 's' to skip"
    if ($response -ne 's') {
        Write-Host "Running: supabase functions deploy chat-api-v2" -ForegroundColor Gray
        Write-Host ""
        supabase functions deploy chat-api-v2
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Edge function deployed successfully" -ForegroundColor Green
            
            # Verify function
            Write-Host ""
            Write-Host "Verifying function..." -ForegroundColor Gray
            supabase functions list | Select-String "chat-api-v2"
        } else {
            Write-Host ""
            Write-Host "❌ Function deployment failed" -ForegroundColor Red
            Write-Host "Please check the error messages above" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping function deployment" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Step 5: Test Endpoints
if ($Step5 -or $All) {
    Write-Host "Step 5: Test Endpoints" -ForegroundColor Yellow
    Write-Host "---------------------" -ForegroundColor Yellow
    Write-Host "This will test the /init and analysis endpoints." -ForegroundColor Gray
    Write-Host ""
    
    $response = Read-Host "Press Enter to continue with testing, or 's' to skip"
    if ($response -ne 's') {
        Write-Host "Running: .\scripts\test-wingman-v2.ps1 -TestAll" -ForegroundColor Gray
        Write-Host ""
        .\scripts\test-wingman-v2.ps1 -TestAll
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ All tests passed" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "⚠️  Some tests failed. Please review the output above." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⏭️  Skipping endpoint testing" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set GEMINI_API_KEY in Supabase Dashboard if not already set" -ForegroundColor White
Write-Host "2. Test the Chrome extension on Free4Talk" -ForegroundColor White
Write-Host "3. Monitor function logs: supabase functions logs chat-api-v2" -ForegroundColor White
Write-Host "4. Check performance metrics in Supabase Dashboard" -ForegroundColor White

