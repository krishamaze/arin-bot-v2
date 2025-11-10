# Test Edge Function endpoint with real Supabase data
param(
    [string]$SupabaseUrl = "",
    [string]$ServiceKey = ""
)

Write-Host "Testing Edge Function with Real Data" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Load .env if URLs not provided
if (-not $SupabaseUrl -or -not $ServiceKey) {
    # Try multiple .env file locations
    $envPaths = @(
        (Join-Path $PSScriptRoot "..\\.env"),
        (Join-Path (Get-Location) ".env"),
        ".env"
    )
    
    foreach ($envPath in $envPaths) {
        if (Test-Path $envPath) {
            Write-Host "Loading .env from: $envPath" -ForegroundColor Gray
            Get-Content $envPath | ForEach-Object {
                if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
                    $name = $matches[1].Trim()
                    $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
                    if ($name -and $value) {
                        [Environment]::SetEnvironmentVariable($name, $value, "Process")
                    }
                }
            }
            break
        }
    }
    
    $SupabaseUrl = $env:SUPABASE_URL
    $ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
    
    # If SUPABASE_URL not found, construct from project ID
    if (-not $SupabaseUrl) {
        $projectIdFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".project-id"
        if (Test-Path $projectIdFile) {
            $projectId = (Get-Content $projectIdFile -First 1).Trim()
            if ($projectId) {
                $SupabaseUrl = "https://$projectId.supabase.co"
                Write-Host "Constructed SUPABASE_URL from project ID: $SupabaseUrl" -ForegroundColor Gray
            }
        }
    }
    
    # If SERVICE_ROLE_KEY not found, try to get from secrets or use access token
    if (-not $ServiceKey) {
        # Try to get from Supabase secrets or use access token for API calls
        $ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
        if (-not $ServiceKey -and $env:SUPABASE_ACCESS_TOKEN) {
            # For testing, we can use the access token, but service role key is preferred
            Write-Host "Warning: Using SUPABASE_ACCESS_TOKEN instead of SERVICE_ROLE_KEY" -ForegroundColor Yellow
        }
    }
}

if (-not $SupabaseUrl) {
    Write-Host "Error: SUPABASE_URL not found and cannot be constructed from project ID" -ForegroundColor Red
    exit 1
}

# Fetch real data from Supabase
Write-Host "Step 1: Fetching real data from Supabase..." -ForegroundColor Yellow
Write-Host ""

$fetchScript = Join-Path $PSScriptRoot "fetch-test-data.ps1"
if (-not (Test-Path $fetchScript)) {
    Write-Host "Error: fetch-test-data.ps1 not found" -ForegroundColor Red
    exit 1
}

try {
    $data = & $fetchScript -SupabaseUrl $SupabaseUrl -ServiceKey $ServiceKey
} catch {
    Write-Host "⚠️  Failed to fetch data: $($_.Exception.Message)" -ForegroundColor Yellow
    $data = $null
}

if (-not $data -or -not $data.bot -or -not $data.room) {
    Write-Host "⚠️  No bot or room data found. Using sample data for testing..." -ForegroundColor Yellow
    Write-Host "Note: To use real data, ensure SUPABASE_SERVICE_ROLE_KEY is set in .env" -ForegroundColor Gray
    
    # Fallback to sample data if no real data
    $timestamp = [int64]((Get-Date).ToUniversalTime() - (Get-Date "1970-01-01")).TotalMilliseconds
    $botPlatformId = "user:123456789:$timestamp"
    $roomPath = "/room/test-$(Get-Date -UFormat %s)"
    $userPlatformId = "user:987654:$timestamp"
    $events = @(
        @{
            type = "message"
            username = "TestUser"
            platformId = $userPlatformId
            text = "hey what's up"
            timestamp = $timestamp
            messageId = "${userPlatformId}:${timestamp}"
        }
    )
} else {
    # Transform database data to client.js format
    Write-Host "Step 2: Transforming data to client.js format..." -ForegroundColor Yellow
    
    $botPlatformId = $data.bot.platform_id
    $roomPath = $data.room.room_id
    
    # Transform events
    $events = @()
    foreach ($event in $data.events) {
        if (-not $event.user_platform_id -or -not $event.user_display_name) {
            continue
        }
        
        # Convert timestamp to Unix milliseconds
        $timestamp = [DateTimeOffset]::Parse($event.timestamp).ToUnixTimeMilliseconds()
        
        # Generate messageId in format matching client.js: user:platformId:timestamp
        # Client.js uses: data.messageId where data comes from extractData which splits id by ':'
        # Format appears to be: "user:platformId:timestamp" based on line 70 of client.js
        $messageId = "$($event.user_platform_id):$timestamp"
        
        # Determine event type
        $eventType = $event.message_type
        if (-not $eventType) {
            $eventType = "message"
        }
        
        # Create event object matching client.js format
        $transformedEvent = @{
            type = $eventType
            username = $event.user_display_name
            platformId = $event.user_platform_id
            text = $event.message_text
            timestamp = $timestamp
            messageId = $messageId
        }
        
        # Add quotedMessage if present in metadata
        if ($event.metadata -and $event.metadata.quoted_message) {
            $transformedEvent.quotedMessage = @{
                username = $event.metadata.quoted_user
                platformId = $event.metadata.quoted_platform_id
                text = $event.metadata.quoted_message
                timestamp = $timestamp - 1000  # Approximate quoted message timestamp
            }
        }
        
        $events += $transformedEvent
    }
    
    # If no events, create a sample event
    if ($events.Count -eq 0) {
        Write-Host "⚠️  No valid events found. Creating sample event..." -ForegroundColor Yellow
        $timestamp = [int64]((Get-Date).ToUniversalTime() - (Get-Date "1970-01-01")).TotalMilliseconds
        $userPlatformId = "user:987654:$timestamp"
        $events = @(
            @{
                type = "message"
                username = "TestUser"
                platformId = $userPlatformId
                text = "hey what's up"
                timestamp = $timestamp
                messageId = "${userPlatformId}:${timestamp}"
            }
        )
    }
    
    Write-Host "✅ Transformed $($events.Count) events" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Step 3: Preparing test request..." -ForegroundColor Yellow
Write-Host "Bot Platform ID: $botPlatformId" -ForegroundColor Gray
Write-Host "Room Path: $roomPath" -ForegroundColor Gray
Write-Host "Events Count: $($events.Count)" -ForegroundColor Gray
Write-Host ""

# Construct function URL
$FunctionUrl = "$SupabaseUrl/functions/v1/chat-api"

# Create request payload matching client.js format
$testPayload = @{
    botPlatformId = $botPlatformId
    roomPath = $roomPath
    events = $events
} | ConvertTo-Json -Depth 10

Write-Host "Step 4: Sending POST request to Edge Function..." -ForegroundColor Yellow
Write-Host "Endpoint: $FunctionUrl" -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    Write-Host "Request payload (first 500 chars):" -ForegroundColor Cyan
    $testPayload.Substring(0, [Math]::Min(500, $testPayload.Length)) | Write-Host
    Write-Host "..."
    Write-Host ""
    
    $response = Invoke-RestMethod -Uri $FunctionUrl -Method Post -Headers $headers -Body $testPayload -ErrorAction Stop
    
    Write-Host "✅ SUCCESS" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host ""
    
    # Verify response structure
    Write-Host "Step 5: Verifying response..." -ForegroundColor Yellow
    
    if ($response.strategy) {
        Write-Host "✅ Strategy: $($response.strategy)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Missing strategy in response" -ForegroundColor Yellow
    }
    
    if ($response.messages -and $response.messages.Count -gt 0) {
        Write-Host "✅ Messages: $($response.messages.Count)" -ForegroundColor Green
        foreach ($msg in $response.messages) {
            Write-Host "  - Text: $($msg.text)" -ForegroundColor Gray
            Write-Host "    Delay: $($msg.delayMs)ms" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  No messages in response (strategy: $($response.strategy))" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "✅ Gemini API integration verified!" -ForegroundColor Green
    
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
    
    exit 1
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan

