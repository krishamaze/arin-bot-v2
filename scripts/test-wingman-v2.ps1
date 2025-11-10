# Test script for Wingman chat-api-v2 edge function
param(
    [string]$SupabaseUrl = "",
    [string]$ServiceKey = "",
    [switch]$TestInit = $false,
    [switch]$TestAnalysis = $false,
    [switch]$TestAll = $true
)

Write-Host "Testing Wingman chat-api-v2 Edge Function" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
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

if (-not $SupabaseUrl) {
    Write-Host "Error: SUPABASE_URL not found" -ForegroundColor Red
    exit 1
}

# Construct function URL
$FunctionUrl = "$SupabaseUrl/functions/v1/chat-api-v2"
$InitUrl = "$FunctionUrl/init"

Write-Host "Function URL: $FunctionUrl" -ForegroundColor Green
Write-Host "Init URL: $InitUrl" -ForegroundColor Green
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ServiceKey"
}

# Test 1: Initialization Endpoint
if ($TestInit -or $TestAll) {
    Write-Host "Test 1: Initialization Endpoint" -ForegroundColor Yellow
    Write-Host "-------------------------------" -ForegroundColor Yellow
    
    $testPlatformId = "test-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $testUsername = "TestUser"
    $testRoomPath = "/test-room-$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    $initPayload = @{
        platformId = $testPlatformId
        username = $testUsername
        roomPath = $testRoomPath
    } | ConvertTo-Json
    
    Write-Host "Payload: $initPayload" -ForegroundColor Gray
    Write-Host ""
    
    try {
        $response = Invoke-RestMethod -Uri $InitUrl -Method Post -Headers $headers -Body $initPayload -ErrorAction Stop
        
        Write-Host "✅ SUCCESS" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Cyan
        $response | ConvertTo-Json -Depth 10 | Write-Host
        
        $script:conversationId = $response.conversationId
        $script:userId = $response.userId
        
        Write-Host ""
        Write-Host "✅ Conversation ID: $($response.conversationId)" -ForegroundColor Green
        Write-Host "✅ User ID: $($response.userId)" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "❌ ERROR" -ForegroundColor Red
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
        }
        exit 1
    }
}

# Test 2: Validation Errors
if ($TestAll) {
    Write-Host "Test 2: Validation Errors" -ForegroundColor Yellow
    Write-Host "-------------------------" -ForegroundColor Yellow
    
    # Test missing fields
    $invalidPayload = @{
        platformId = ""  # Empty platform ID
    } | ConvertTo-Json
    
    Write-Host "Testing with invalid payload (empty platformId)..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $InitUrl -Method Post -Headers $headers -Body $invalidPayload -ErrorAction Stop
        Write-Host "❌ ERROR: Should have failed validation" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "✅ SUCCESS: Validation error caught (400)" -ForegroundColor Green
        } else {
            Write-Host "❌ ERROR: Unexpected status code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Test 3: Wingman Analysis Endpoint
if ($TestAnalysis -or $TestAll) {
    if (-not $script:conversationId) {
        Write-Host "⚠️  Skipping analysis test - initialization failed" -ForegroundColor Yellow
    } else {
        Write-Host "Test 3: Wingman Analysis Endpoint" -ForegroundColor Yellow
        Write-Host "----------------------------------" -ForegroundColor Yellow
        
        $testGirlId = "test-girl-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $testGirlName = "TestGirl"
        
        $analysisPayload = @{
            conversationId = $script:conversationId
            userId = $script:userId
            girlId = $testGirlId
            girlName = $testGirlName
            recentMessages = @(
                @{
                    sender = "girl"
                    text = "Hey! How are you?"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                },
                @{
                    sender = "user"
                    text = "I'm good, thanks! How about you?"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                },
                @{
                    sender = "girl"
                    text = "Pretty good! What are you up to?"
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                }
            )
        } | ConvertTo-Json -Depth 10
        
        Write-Host "Payload: $analysisPayload" -ForegroundColor Gray
        Write-Host ""
        
        try {
            $response = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body $analysisPayload -ErrorAction Stop
            
            Write-Host "✅ SUCCESS" -ForegroundColor Green
            Write-Host "Response:" -ForegroundColor Cyan
            $response | ConvertTo-Json -Depth 10 | Write-Host
            
            # Validate response structure
            if ($response.analysis -and $response.suggestions -and $response.wingman_tip) {
                Write-Host ""
                Write-Host "✅ Response structure valid" -ForegroundColor Green
                Write-Host "✅ Analysis: $($response.analysis.conversation_vibe)" -ForegroundColor Green
                Write-Host "✅ Suggestions: $($response.suggestions.Count)" -ForegroundColor Green
                Write-Host "✅ Wingman Tip: $($response.wingman_tip.Substring(0, [Math]::Min(50, $response.wingman_tip.Length)))..." -ForegroundColor Green
            } else {
                Write-Host "⚠️  WARNING: Response structure incomplete" -ForegroundColor Yellow
            }
            
        } catch {
            Write-Host "❌ ERROR" -ForegroundColor Red
            Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
            Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
            
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
            }
        }
        Write-Host ""
    }
}

# Test 4: Invalid Conversation ID
if ($TestAll) {
    Write-Host "Test 4: Invalid Conversation ID" -ForegroundColor Yellow
    Write-Host "-------------------------------" -ForegroundColor Yellow
    
    $invalidPayload = @{
        conversationId = "invalid-uuid-123"
        userId = "test-user"
        girlId = "test-girl"
    } | ConvertTo-Json
    
    Write-Host "Testing with invalid conversationId..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body $invalidPayload -ErrorAction Stop
        Write-Host "❌ ERROR: Should have failed validation" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "✅ SUCCESS: Validation error caught (400)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Status code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

Write-Host "Test complete!" -ForegroundColor Cyan

