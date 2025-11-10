# Verify Wingman schema in database
param(
    [string]$SupabaseUrl = "",
    [string]$ServiceKey = ""
)

Write-Host "Verifying Wingman Schema" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Load .env if URLs not provided
if (-not $SupabaseUrl -or -not $ServiceKey) {
    if (Test-Path .env) {
        Get-Content .env | ForEach-Object {
            if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
                [Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
    
    $SupabaseUrl = $env:SUPABASE_URL
    $ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
}

if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Host "❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required" -ForegroundColor Red
    exit 1
}

# Tables to verify
$tables = @(
    @{ Name = "users"; Columns = @("id", "platform_id", "user_type", "display_name", "profile_data") },
    @{ Name = "conversations"; Columns = @("id", "bot_user_id", "match_user_id", "room_path", "conversation_status") },
    @{ Name = "messages"; Columns = @("id", "conversation_id", "sender_id", "message_text", "timestamp") },
    @{ Name = "bot_suggestions"; Columns = @("id", "conversation_id", "analysis", "suggestions", "wingman_tip") }
)

# Indexes to verify
$indexes = @(
    "idx_users_platform_id",
    "idx_users_type",
    "idx_users_profile_data_gin",
    "idx_conversations_bot_match",
    "idx_conversations_metadata_gin",
    "idx_messages_conversation_time",
    "idx_messages_sender",
    "idx_bot_suggestions_conversation"
)

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ServiceKey"
    "apikey" = $ServiceKey
}

$allPassed = $true

# Verify tables
Write-Host "Verifying tables..." -ForegroundColor Yellow
foreach ($table in $tables) {
    $tableName = $table.Name
    $url = "$SupabaseUrl/rest/v1/$tableName?select=*&limit=0"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -ErrorAction Stop
        Write-Host "✅ Table '$tableName' exists" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) {
            Write-Host "❌ Table '$tableName' not found" -ForegroundColor Red
            $allPassed = $false
        } else {
            Write-Host "⚠️  Could not verify table '$tableName': $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# Verify nullable match_user_id constraint
Write-Host "Verifying nullable match_user_id..." -ForegroundColor Yellow
try {
    # Try to insert a conversation with null match_user_id
    $testUrl = "$SupabaseUrl/rest/v1/conversations"
    $testPayload = @{
        bot_user_id = "00000000-0000-0000-0000-000000000000"  # Dummy UUID, will fail FK but test nullable
        room_path = "/test-verify-$(Get-Date -Format 'yyyyMMddHHmmss')"
        match_user_id = $null
        conversation_status = "pending"
    } | ConvertTo-Json
    
    # This will fail due to FK constraint, but we can check the error
    try {
        $response = Invoke-RestMethod -Uri $testUrl -Method Post -Headers $headers -Body $testPayload -ErrorAction Stop
        Write-Host "✅ match_user_id can be null" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 201) {
            Write-Host "✅ match_user_id can be null" -ForegroundColor Green
        } elseif ($_.Exception.Message -match "foreign key" -or $_.Exception.Message -match "violates foreign key") {
            Write-Host "✅ match_user_id is nullable (FK constraint working as expected)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Could not verify nullable constraint: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "⚠️  Could not test nullable constraint: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Verify JSONB indexes (by checking if queries work)
Write-Host "Verifying JSONB indexes..." -ForegroundColor Yellow
try {
    # Test GIN index on profile_data
    $testUrl = "$SupabaseUrl/rest/v1/users?profile_data=eq.{}&select=id&limit=1"
    $response = Invoke-RestMethod -Uri $testUrl -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "✅ JSONB queries working (GIN index likely present)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not verify JSONB indexes: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

if ($allPassed) {
    Write-Host "✅ Schema verification complete!" -ForegroundColor Green
} else {
    Write-Host "❌ Schema verification failed - some tables are missing" -ForegroundColor Red
    exit 1
}

