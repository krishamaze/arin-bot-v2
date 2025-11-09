# Test script for chat-api edge function
param(
    [string]$SupabaseUrl = "",
    [string]$ServiceKey = ""
)

Write-Host "Testing chat-api Edge Function" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host ""

# Load .env if URLs not provided
if (-not $SupabaseUrl -or -not $ServiceKey) {
    if (Test-Path ..\.env) {
        Get-Content ..\.env | ForEach-Object {
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
$FunctionUrl = "$SupabaseUrl/functions/v1/chat-api"

Write-Host "Function URL: $FunctionUrl" -ForegroundColor Green
Write-Host ""

# Test payload
$testPayload = @{
    botPlatformId = "test-bot-123"
    roomPath = "/test-room"
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

Write-Host "Sending test request..." -ForegroundColor Yellow
Write-Host "Payload: $testPayload" -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ServiceKey"
    }
    
    $response = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body $testPayload -ErrorAction Stop
    
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ ERROR" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan

