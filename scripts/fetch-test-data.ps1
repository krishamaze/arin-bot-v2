# Fetch real test data from Supabase cloud database
param(
    [string]$SupabaseUrl = "",
    [string]$ServiceKey = ""
)

Write-Host "Fetching test data from Supabase..." -ForegroundColor Cyan
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
            }
        }
    }
    
    # If SERVICE_ROLE_KEY not found, try access token
    if (-not $ServiceKey) {
        $ServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY
        if (-not $ServiceKey) {
            $ServiceKey = $env:SUPABASE_ACCESS_TOKEN
        }
    }
}

if (-not $SupabaseUrl) {
    Write-Host "Error: SUPABASE_URL not found and cannot be constructed" -ForegroundColor Red
    exit 1
}

if (-not $ServiceKey) {
    Write-Host "Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ACCESS_TOKEN not found" -ForegroundColor Red
    exit 1
}

$headers = @{
    "apikey" = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
    "Content-Type" = "application/json"
}

try {
    # Fetch latest bot
    Write-Host "Fetching latest bot..." -ForegroundColor Yellow
    $botUrl = "$SupabaseUrl/rest/v1/bots?order=created_at.desc&limit=1&select=platform_id,username,personality"
    $bots = Invoke-RestMethod -Uri $botUrl -Method Get -Headers $headers -ErrorAction Stop
    
    if ($bots.Count -eq 0) {
        Write-Host "⚠️  No bots found in database" -ForegroundColor Yellow
        $bot = $null
    } else {
        $bot = $bots[0]
        Write-Host "✅ Found bot: $($bot.username) ($($bot.platform_id))" -ForegroundColor Green
    }
    
    # Fetch latest room
    Write-Host "Fetching latest room..." -ForegroundColor Yellow
    $roomUrl = "$SupabaseUrl/rest/v1/rooms?order=created_at.desc&limit=1&select=room_id"
    $rooms = Invoke-RestMethod -Uri $roomUrl -Method Get -Headers $headers -ErrorAction Stop
    
    if ($rooms.Count -eq 0) {
        Write-Host "⚠️  No rooms found in database" -ForegroundColor Yellow
        $room = $null
    } else {
        $room = $rooms[0]
        Write-Host "✅ Found room: $($room.room_id)" -ForegroundColor Green
    }
    
    # Fetch recent events (last 10)
    Write-Host "Fetching recent events..." -ForegroundColor Yellow
    $eventsUrl = "$SupabaseUrl/rest/v1/events?order=timestamp.desc&limit=10&select=user_platform_id,user_display_name,message_text,message_type,timestamp,metadata"
    $events = Invoke-RestMethod -Uri $eventsUrl -Method Get -Headers $headers -ErrorAction Stop
    
    Write-Host "✅ Found $($events.Count) events" -ForegroundColor Green
    Write-Host ""
    
    # Return data as PowerShell object
    return @{
        bot = $bot
        room = $room
        events = $events
    }
    
} catch {
    Write-Host "⚠️  ERROR fetching data (will use sample data)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            Write-Host "Note: 401 Unauthorized - Service role key may be required for REST API access" -ForegroundColor Gray
        }
    }
    # Return null to indicate no data fetched
    return $null
}

