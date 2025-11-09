# Setup script to login and link to correct Supabase project
# Run this script to login and link to the correct project

$ExpectedProjectId = "opaxtxfxropmjrrqlewh"

Write-Host "🔐 Supabase Project Setup" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check if already logged in
Write-Host "1. Checking login status..." -ForegroundColor Yellow
try {
    $projects = supabase projects list 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Already logged in" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   ⚠️  Not logged in or no access" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "2. Please login to Supabase..." -ForegroundColor Yellow
        Write-Host "   This will open a browser window for authentication" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Run this command manually:" -ForegroundColor White
        Write-Host "   supabase login" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Press Enter after you've completed the login..." -ForegroundColor Yellow
        Read-Host
        Write-Host ""
    }
} catch {
    Write-Host "   ⚠️  Not logged in" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "2. Please login to Supabase..." -ForegroundColor Yellow
    Write-Host "   This will open a browser window for authentication" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Run this command manually:" -ForegroundColor White
    Write-Host "   supabase login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Press Enter after you've completed the login..." -ForegroundColor Yellow
    Read-Host
    Write-Host ""
}

# Check accessible projects
Write-Host "3. Checking accessible projects..." -ForegroundColor Yellow
try {
    $projectsOutput = supabase projects list --output json 2>&1 | Out-String
    $projects = $projectsOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
    
    if ($projects -and $projects.value) {
        Write-Host "   Available projects:" -ForegroundColor Cyan
        $foundProject = $false
        foreach ($project in $projects.value) {
            $isLinked = if ($project.LINKED -eq "true") { " (LINKED)" } else { "" }
            Write-Host "   - $($project.'REFERENCE ID') : $($project.NAME)$isLinked" -ForegroundColor White
            
            if ($project.'REFERENCE ID' -eq $ExpectedProjectId) {
                $foundProject = $true
            }
        }
        Write-Host ""
        
        if (-not $foundProject) {
            Write-Host "   ⚠️  WARNING: Project $ExpectedProjectId not found in your accessible projects!" -ForegroundColor Red
            Write-Host ""
            Write-Host "   Possible reasons:" -ForegroundColor Yellow
            Write-Host "   1. You're logged in with the wrong account" -ForegroundColor Gray
            Write-Host "   2. You don't have access to this project" -ForegroundColor Gray
            Write-Host "   3. The project ID is incorrect" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   Please verify:" -ForegroundColor Yellow
            Write-Host "   - Check the Supabase dashboard: https://supabase.com/dashboard" -ForegroundColor Gray
            Write-Host "   - Verify the project ID: $ExpectedProjectId" -ForegroundColor Gray
            Write-Host ""
            exit 1
        } else {
            Write-Host "   ✅ Project $ExpectedProjectId is accessible" -ForegroundColor Green
            Write-Host ""
        }
    }
} catch {
    Write-Host "   ⚠️  Could not list projects" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Unlink if already linked to wrong project
Write-Host "4. Checking current link..." -ForegroundColor Yellow
try {
    $status = supabase status 2>&1 | Out-String
    if ($status -match "Linked project") {
        Write-Host "   ⚠️  Project is already linked" -ForegroundColor Yellow
        Write-Host "   Unlinking..." -ForegroundColor Gray
        supabase unlink 2>&1 | Out-Null
        Write-Host "   ✅ Unlinked" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   ✅ No project linked" -ForegroundColor Green
        Write-Host ""
    }
} catch {
    Write-Host "   ✅ No project linked (or error checking)" -ForegroundColor Green
    Write-Host ""
}

# Link to correct project
Write-Host "5. Linking to project $ExpectedProjectId..." -ForegroundColor Yellow
try {
    supabase link --project-ref $ExpectedProjectId 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Successfully linked to project $ExpectedProjectId" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   ❌ Failed to link project" -ForegroundColor Red
        Write-Host "   Please check:" -ForegroundColor Yellow
        Write-Host "   - You have access to this project" -ForegroundColor Gray
        Write-Host "   - The project ID is correct: $ExpectedProjectId" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host "   ❌ Error linking project: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Verify link
Write-Host "6. Verifying link..." -ForegroundColor Yellow
try {
    $functions = supabase functions list --output json 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Link verified successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✅ Setup complete! Project is linked to: $ExpectedProjectId" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now deploy using:" -ForegroundColor Cyan
        Write-Host "   .\deploy.ps1" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "   ⚠️  Could not verify link (this might be normal)" -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    Write-Host "   ⚠️  Could not verify link" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Setup complete!" -ForegroundColor Green

