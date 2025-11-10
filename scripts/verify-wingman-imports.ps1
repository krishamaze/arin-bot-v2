# Verify Wingman edge function imports and structure
param(
    [string]$FunctionPath = "supabase/functions/chat-api-v2"
)

Write-Host "Verifying Wingman Edge Function Structure" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Check required files
$requiredFiles = @(
    "$FunctionPath/index.ts",
    "$FunctionPath/deno.json",
    "supabase/functions/_shared/supabaseClient.ts",
    "supabase/functions/_shared/geminiClient.ts",
    "supabase/functions/_shared/schemas.ts",
    "supabase/functions/_shared/prompts.ts",
    "supabase/functions/_shared/utils.ts"
)

Write-Host "Checking required files..." -ForegroundColor Yellow
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file - NOT FOUND" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check imports in index.ts
Write-Host "Checking imports in index.ts..." -ForegroundColor Yellow
$indexContent = Get-Content "$FunctionPath/index.ts" -Raw

$requiredImports = @(
    "from '../_shared/supabaseClient.ts'",
    "from '../_shared/schemas.ts'",
    "from '../_shared/prompts.ts'",
    "from '../_shared/utils.ts'",
    "from '../_shared/geminiClient.ts'"
)

foreach ($import in $requiredImports) {
    if ($indexContent -match [regex]::Escape($import)) {
        Write-Host "✅ Import found: $import" -ForegroundColor Green
    } else {
        Write-Host "❌ Import missing: $import" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check for endpoint handlers
Write-Host "Checking endpoint handlers..." -ForegroundColor Yellow
if ($indexContent -match "handleInit") {
    Write-Host "✅ handleInit function found" -ForegroundColor Green
} else {
    Write-Host "❌ handleInit function missing" -ForegroundColor Red
    $allPassed = $false
}

if ($indexContent -match "handleWingmanAnalysis") {
    Write-Host "✅ handleWingmanAnalysis function found" -ForegroundColor Green
} else {
    Write-Host "❌ handleWingmanAnalysis function missing" -ForegroundColor Red
    $allPassed = $false
}

if ($indexContent -match "/init") {
    Write-Host "✅ /init endpoint found" -ForegroundColor Green
} else {
    Write-Host "❌ /init endpoint missing" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check schemas.ts for Zod schemas
Write-Host "Checking Zod schemas..." -ForegroundColor Yellow
$schemasContent = Get-Content "supabase/functions/_shared/schemas.ts" -Raw

$requiredSchemas = @(
    "InitRequestSchema",
    "WingmanRequestSchema",
    "WingmanResponseSchema"
)

foreach ($schema in $requiredSchemas) {
    if ($schemasContent -match $schema) {
        Write-Host "✅ Schema found: $schema" -ForegroundColor Green
    } else {
        Write-Host "❌ Schema missing: $schema" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check prompts.ts for WINGMAN_PROMPT
Write-Host "Checking prompts..." -ForegroundColor Yellow
$promptsContent = Get-Content "supabase/functions/_shared/prompts.ts" -Raw

if ($promptsContent -match "WINGMAN_PROMPT") {
    Write-Host "✅ WINGMAN_PROMPT found" -ForegroundColor Green
} else {
    Write-Host "❌ WINGMAN_PROMPT missing" -ForegroundColor Red
    $allPassed = $false
}

if ($promptsContent -match "PROMPT_VERSION") {
    Write-Host "✅ PROMPT_VERSION found" -ForegroundColor Green
} else {
    Write-Host "❌ PROMPT_VERSION missing" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check geminiClient.ts for cache functions
Write-Host "Checking Gemini client cache functions..." -ForegroundColor Yellow
$geminiContent = Get-Content "supabase/functions/_shared/geminiClient.ts" -Raw

if ($geminiContent -match "getOrCreateCache") {
    Write-Host "✅ getOrCreateCache function found" -ForegroundColor Green
} else {
    Write-Host "❌ getOrCreateCache function missing" -ForegroundColor Red
    $allPassed = $false
}

if ($geminiContent -match "generateWithCache") {
    Write-Host "✅ generateWithCache function found" -ForegroundColor Green
} else {
    Write-Host "❌ generateWithCache function missing" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check utils.ts for helper functions
Write-Host "Checking utility functions..." -ForegroundColor Yellow
$utilsContent = Get-Content "supabase/functions/_shared/utils.ts" -Raw

$requiredUtils = @(
    "getOrCreateUser",
    "getOrCreateConversation",
    "updateConversationWithMatch",
    "fetchUserProfile",
    "storeMessages",
    "formatRecentMessages",
    "storeBotSuggestion"
)

foreach ($util in $requiredUtils) {
    if ($utilsContent -match $util) {
        Write-Host "✅ Utility found: $util" -ForegroundColor Green
    } else {
        Write-Host "❌ Utility missing: $util" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check migration file
Write-Host "Checking migration file..." -ForegroundColor Yellow
$migrationFile = "supabase/migrations/20251109000000_wingman_schema.sql"
if (Test-Path $migrationFile) {
    Write-Host "✅ Migration file found" -ForegroundColor Green
    
    $migrationContent = Get-Content $migrationFile -Raw
    
    $requiredTables = @("users", "conversations", "messages", "bot_suggestions")
    foreach ($table in $requiredTables) {
        if ($migrationContent -match "CREATE TABLE.*$table") {
            Write-Host "✅ Table creation found: $table" -ForegroundColor Green
        } else {
            Write-Host "❌ Table creation missing: $table" -ForegroundColor Red
            $allPassed = $false
        }
    }
} else {
    Write-Host "❌ Migration file not found" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

if ($allPassed) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Deploy migration: .\scripts\deploy-wingman-v2.ps1 -SkipFunction" -ForegroundColor White
    Write-Host "2. Deploy function: .\scripts\deploy-wingman-v2.ps1 -SkipMigration" -ForegroundColor White
    Write-Host "3. Test endpoints: .\scripts\test-wingman-v2.ps1 -TestAll" -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ Some checks failed. Please fix the issues above." -ForegroundColor Red
    exit 1
}

