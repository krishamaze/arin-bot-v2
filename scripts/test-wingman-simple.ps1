# Simple test script for Wingman v2 - tests without authentication if JWT is disabled
param(
    [string]$SupabaseUrl = "https://opaxtxfxropmjrrqlewh.supabase.co"
)

Write-Host "Testing Wingman chat-api-v2 (Simple Test)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$FunctionUrl = "$SupabaseUrl/functions/v1/chat-api-v2"
$InitUrl = "$FunctionUrl/init"

Write-Host "Function URL: $FunctionUrl" -ForegroundColor Green
Write-Host ""

# Test without authentication (if JWT verification is disabled)
$headers = @{
    "Content-Type" = "application/json"
}

# Test 1: Initialization
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
    
    Write-Host "✅ Test 1 PASSED - Initialization successful!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
        
        if ($responseBody -match "401" -or $responseBody -match "Unauthorized" -or $responseBody -match "JWT") {
            Write-Host ""
            Write-Host "⚠️  Authentication required. You need to:" -ForegroundColor Yellow
            Write-Host "   1. Get SERVICE_ROLE_KEY from Supabase Dashboard" -ForegroundColor White
            Write-Host "   2. Or configure function to disable JWT verification in Dashboard" -ForegroundColor White
            Write-Host "   3. Or update test script to use SERVICE_ROLE_KEY" -ForegroundColor White
        }
    }
    exit 1
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan

