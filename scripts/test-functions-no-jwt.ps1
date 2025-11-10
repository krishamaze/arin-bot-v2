# Test functions without JWT authentication
param(
    [string]$SupabaseUrl = "https://opaxtxfxropmjrrqlewh.supabase.co"
)

Write-Host "Testing Edge Functions WITHOUT JWT" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$FunctionUrls = @{
    "chat-api" = "$SupabaseUrl/functions/v1/chat-api"
    "chat-api-v2" = "$SupabaseUrl/functions/v1/chat-api-v2"
}

$headers = @{
    "Content-Type" = "application/json"
}

foreach ($functionName in $FunctionUrls.Keys) {
    $functionUrl = $FunctionUrls[$functionName]
    Write-Host "Testing: $functionName" -ForegroundColor Yellow
    Write-Host "URL: $functionUrl" -ForegroundColor Gray
    Write-Host ""
    
    # Test payload for chat-api
    if ($functionName -eq "chat-api") {
        $testPayload = @{
            botPlatformId = "test-bot-$(Get-Date -Format 'yyyyMMddHHmmss')"
            roomPath = "/test-room-$(Get-Date -Format 'yyyyMMddHHmmss')"
            events = @(
                @{
                    type = "message"
                    username = "testuser"
                    platformId = "user-123"
                    text = "Hello, bot!"
                    timestamp = (Get-Date).ToUniversalTime().ToString("o")
                }
            )
        } | ConvertTo-Json -Depth 10
        
        Write-Host "Payload:" -ForegroundColor Gray
        Write-Host $testPayload -ForegroundColor DarkGray
        Write-Host ""
        
        try {
            $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Headers $headers -Body $testPayload -ErrorAction Stop
            Write-Host "✅ SUCCESS (200 OK)" -ForegroundColor Green
            Write-Host "Response:" -ForegroundColor Cyan
            $response | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "❌ ERROR: Status $statusCode" -ForegroundColor Red
            
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
                
                if ($statusCode -eq 401 -or $responseBody -match "Unauthorized" -or $responseBody -match "JWT") {
                    Write-Host "⚠️  JWT Authentication required - verify_jwt might not be disabled" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    # Test payload for chat-api-v2
    if ($functionName -eq "chat-api-v2") {
        $testPayload = @{
            platformId = "test-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
            username = "TestUser"
            roomPath = "/test-room-$(Get-Date -Format 'yyyyMMddHHmmss')"
        } | ConvertTo-Json -Depth 10
        
        Write-Host "Testing /init endpoint:" -ForegroundColor Gray
        Write-Host "Payload:" -ForegroundColor Gray
        Write-Host $testPayload -ForegroundColor DarkGray
        Write-Host ""
        
        try {
            $response = Invoke-RestMethod -Uri "$functionUrl/init" -Method Post -Headers $headers -Body $testPayload -ErrorAction Stop
            Write-Host "✅ SUCCESS (200 OK)" -ForegroundColor Green
            Write-Host "Response:" -ForegroundColor Cyan
            $response | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "❌ ERROR: Status $statusCode" -ForegroundColor Red
            
            if ($_.Exception.Response) {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
                
                if ($statusCode -eq 401 -or $responseBody -match "Unauthorized" -or $responseBody -match "JWT") {
                    Write-Host "⚠️  JWT Authentication required - verify_jwt might not be disabled" -ForegroundColor Yellow
                }
            } else {
                Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "---" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Test complete!" -ForegroundColor Cyan


