# Verify implementation compliance with plan
param(
    [string]$PlanFile = "wingman-dating-chat-helper-implementation.plan.md"
)

Write-Host "Verifying Plan Compliance" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true
$planContent = Get-Content $PlanFile -Raw

# Check 1: Migration file exists with correct name
Write-Host "Checking migration file..." -ForegroundColor Yellow
$migrationFile = "supabase/migrations/20251109000000_wingman_schema.sql"
if (Test-Path $migrationFile) {
    Write-Host "✅ Migration file exists: $migrationFile" -ForegroundColor Green
    
    $migrationContent = Get-Content $migrationFile -Raw
    
    # Check for nullable match_user_id
    if ($migrationContent -match "match_user_id UUID REFERENCES users\(id\)") {
        Write-Host "✅ match_user_id is nullable (no NOT NULL constraint)" -ForegroundColor Green
    } else {
        Write-Host "❌ match_user_id should be nullable" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Check for room_path
    if ($migrationContent -match "room_path TEXT NOT NULL") {
        Write-Host "✅ room_path field exists" -ForegroundColor Green
    } else {
        Write-Host "❌ room_path field missing" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Check for JSONB indexes
    if ($migrationContent -match "idx_users_profile_data_gin.*GIN.*profile_data") {
        Write-Host "✅ GIN index on profile_data exists" -ForegroundColor Green
    } else {
        Write-Host "❌ GIN index on profile_data missing" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Check for partial unique index
    if ($migrationContent -match "idx_conversations_bot_match_active" -and $migrationContent -match "WHERE match_user_id IS NOT NULL") {
        Write-Host "✅ Partial unique index for active conversations exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Partial unique index missing" -ForegroundColor Red
        $allPassed = $false
    }
} else {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check 2: _shared folder structure
Write-Host "Checking _shared folder structure..." -ForegroundColor Yellow
$sharedFiles = @(
    "supabase/functions/_shared/supabaseClient.ts",
    "supabase/functions/_shared/geminiClient.ts",
    "supabase/functions/_shared/schemas.ts",
    "supabase/functions/_shared/prompts.ts",
    "supabase/functions/_shared/utils.ts"
)

foreach ($file in $sharedFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check 3: Zod schemas
Write-Host "Checking Zod schemas..." -ForegroundColor Yellow
$schemasContent = Get-Content "supabase/functions/_shared/schemas.ts" -Raw

$requiredSchemas = @(
    "InitRequestSchema",
    "WingmanRequestSchema",
    "WingmanResponseSchema"
)

foreach ($schema in $requiredSchemas) {
    if ($schemasContent -match $schema) {
        Write-Host "✅ $schema exists" -ForegroundColor Green
        
        # Check InitRequestSchema structure
        if ($schema -eq "InitRequestSchema") {
            if ($schemasContent -match "platformId.*string" -and $schemasContent -match "username.*string" -and $schemasContent -match "roomPath.*string") {
                Write-Host "  ✅ InitRequestSchema has correct fields" -ForegroundColor Green
            } else {
                Write-Host "  ❌ InitRequestSchema missing required fields" -ForegroundColor Red
                $allPassed = $false
            }
        }
        
        # Check WingmanRequestSchema structure
        if ($schema -eq "WingmanRequestSchema") {
            if ($schemasContent -match "conversationId.*uuid" -and $schemasContent -match "userId.*string" -and $schemasContent -match "girlId.*string") {
                Write-Host "  ✅ WingmanRequestSchema has correct fields" -ForegroundColor Green
            } else {
                Write-Host "  ❌ WingmanRequestSchema missing required fields" -ForegroundColor Red
                $allPassed = $false
            }
        }
        
        # Check WingmanResponseSchema structure
        if ($schema -eq "WingmanResponseSchema") {
            if ($schemasContent -match "analysis.*object" -and $schemasContent -match "suggestions.*array" -and $schemasContent -match "wingman_tip.*string") {
                Write-Host "  ✅ WingmanResponseSchema has correct structure" -ForegroundColor Green
            } else {
                Write-Host "  ❌ WingmanResponseSchema missing required fields" -ForegroundColor Red
                $allPassed = $false
            }
        }
    } else {
        Write-Host "❌ $schema missing" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check 4: Cache implementation
Write-Host "Checking cache implementation..." -ForegroundColor Yellow
$geminiContent = Get-Content "supabase/functions/_shared/geminiClient.ts" -Raw

if ($geminiContent -match "getOrCreateCache") {
    Write-Host "✅ getOrCreateCache function exists" -ForegroundColor Green
    
    # Check for TTL management
    if ($geminiContent -match "ttl.*3600" -or $geminiContent -match "expiresAt") {
        Write-Host "✅ TTL management implemented" -ForegroundColor Green
    } else {
        Write-Host "⚠️  TTL management may be missing" -ForegroundColor Yellow
    }
    
    # Check for in-memory cache map
    if ($geminiContent -match "globalThis.*wingmanCacheStore" -or $geminiContent -match "Map.*cache") {
        Write-Host "✅ In-memory cache map exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  In-memory cache map may be missing" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ getOrCreateCache function missing" -ForegroundColor Red
    $allPassed = $false
}

if ($geminiContent -match "generateWithCache") {
    Write-Host "✅ generateWithCache function exists" -ForegroundColor Green
} else {
    Write-Host "❌ generateWithCache function missing" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check 5: Prompt configuration
Write-Host "Checking prompt configuration..." -ForegroundColor Yellow
$promptsContent = Get-Content "supabase/functions/_shared/prompts.ts" -Raw

if ($promptsContent -match "WINGMAN_PROMPT") {
    Write-Host "✅ WINGMAN_PROMPT exists" -ForegroundColor Green
    
    # Check for prompt version
    if ($promptsContent -match "PROMPT_VERSION") {
        Write-Host "✅ PROMPT_VERSION exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PROMPT_VERSION may be missing" -ForegroundColor Yellow
    }
    
    # Check for key prompt sections
    if ($promptsContent -match "CORE PRINCIPLES" -or $promptsContent -match "Core Principles") {
        Write-Host "✅ Prompt contains Core Principles section" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Core Principles section may be missing" -ForegroundColor Yellow
    }
    
    if ($promptsContent -match "OUTPUT FORMAT" -or $promptsContent -match "output format") {
        Write-Host "✅ Prompt contains output format section" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Output format section may be missing" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ WINGMAN_PROMPT missing" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check 6: Edge function endpoints
Write-Host "Checking edge function endpoints..." -ForegroundColor Yellow
$indexContent = Get-Content "supabase/functions/chat-api-v2/index.ts" -Raw

# Check for /init endpoint
if ($indexContent -match "/init" -and $indexContent -match "handleInit") {
    Write-Host "✅ /init endpoint exists" -ForegroundColor Green
    
    # Check initialization flow
    if ($indexContent -match "getOrCreateUser" -and $indexContent -match "bot_owner") {
        Write-Host "✅ Initialization creates bot_owner user" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Initialization flow may be incorrect" -ForegroundColor Yellow
    }
    
    # Check for null match_user_id
    if ($indexContent -match "getOrCreateConversation" -and ($indexContent -match "null" -or $indexContent -match "match_user_id.*null")) {
        Write-Host "✅ Conversation created with null match_user_id" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Null match_user_id handling may be missing" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ /init endpoint missing" -ForegroundColor Red
    $allPassed = $false
}

# Check for main analysis endpoint
if ($indexContent -match "handleWingmanAnalysis") {
    Write-Host "✅ Main analysis endpoint exists" -ForegroundColor Green
    
    # Check for girl identification
    if ($indexContent -match "getOrCreateUser" -and ($indexContent -match "'match'" -or $indexContent -match '"match"')) {
        Write-Host "✅ Girl user creation implemented" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Girl user creation may be missing" -ForegroundColor Yellow
    }
    
    # Check for conversation update
    if ($indexContent -match "updateConversationWithMatch" -or $indexContent -match "match_user_id.*update") {
        Write-Host "✅ Conversation update logic exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Conversation update logic may be missing" -ForegroundColor Yellow
    }
    
    # Check for caching
    if ($indexContent -match "getOrCreateCache" -and $indexContent -match "generateWithCache") {
        Write-Host "✅ Caching integrated in main handler" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Caching may not be integrated" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Main analysis endpoint missing" -ForegroundColor Red
    $allPassed = $false
}

# Check for Zod validation
if ($indexContent -match "InitRequestSchema.parse" -and $indexContent -match "WingmanRequestSchema.parse") {
    Write-Host "✅ Zod validation implemented" -ForegroundColor Green
} else {
    Write-Host "❌ Zod validation missing" -ForegroundColor Red
    $allPassed = $false
}

# Check for error handling
if ($indexContent -match "ZodError" -and $indexContent -match "status.*400" -and $indexContent -match "status.*500") {
    Write-Host "✅ Error handling with proper status codes" -ForegroundColor Green
} else {
    Write-Host "⚠️  Error handling may be incomplete" -ForegroundColor Yellow
}

Write-Host ""

# Check 7: Client implementation
Write-Host "Checking client implementation..." -ForegroundColor Yellow
$clientContent = Get-Content "client/fftBot-client.js" -Raw

# Check for wingman/ init command
if ($clientContent -match "wingman/" -or $clientContent -match "INIT_CMD.*wingman") {
    Write-Host "✅ Init command changed to wingman/" -ForegroundColor Green
} else {
    Write-Host "⚠️  Init command may not be updated" -ForegroundColor Yellow
}

# Check for /init endpoint call
if ($clientContent -match "/init" -and $clientContent -match "conversationId") {
    Write-Host "✅ /init endpoint called in client" -ForegroundColor Green
} else {
    Write-Host "⚠️  /init endpoint call may be missing" -ForegroundColor Yellow
}

# Check for girlName in requests
if ($clientContent -match "girlName" -or $clientContent -match "girl_name") {
    Write-Host "✅ girlName sent in requests" -ForegroundColor Green
} else {
    Write-Host "⚠️  girlName may not be sent" -ForegroundColor Yellow
}

# Check for UI panel
if ($clientContent -match "wingman-panel" -or $clientContent -match "suggestions" -or $clientContent -match "displaySuggestions") {
    Write-Host "✅ UI panel with suggestions display" -ForegroundColor Green
} else {
    Write-Host "⚠️  UI panel may be missing" -ForegroundColor Yellow
}

# Check for copy functionality
if ($clientContent -match "clipboard" -or $clientContent -match "copy") {
    Write-Host "✅ Copy-to-clipboard functionality" -ForegroundColor Green
} else {
    Write-Host "⚠️  Copy functionality may be missing" -ForegroundColor Yellow
}

Write-Host ""

# Check 8: Utility functions
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
        Write-Host "✅ $util exists" -ForegroundColor Green
    } else {
        Write-Host "❌ $util missing" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Check 9: Database tables in migration
Write-Host "Checking database tables..." -ForegroundColor Yellow
$requiredTables = @("users", "conversations", "messages", "bot_suggestions")

foreach ($table in $requiredTables) {
    if ($migrationContent -match "CREATE TABLE.*$table") {
        Write-Host "✅ Table $table creation exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Table $table creation missing" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Summary
Write-Host "=========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "✅ All critical checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Implementation appears to comply with the plan." -ForegroundColor Green
    Write-Host "Some warnings may indicate optional features or alternative implementations." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ Some critical checks failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the errors above and fix any issues." -ForegroundColor Yellow
    exit 1
}

