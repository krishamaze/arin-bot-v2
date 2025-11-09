# Safe Deployment Script for Supabase Edge Functions
# Verifies the correct project is linked before deploying

param(
    [string]$FunctionName = "chat-api",
    [string]$ExpectedProjectId = "opaxtxfxropmjrrqlewh",
    [switch]$SkipVerification
)

$ErrorActionPreference = "Stop"

# Use local Supabase CLI from virtual environment
function Invoke-Supabase {
    param([string[]]$Arguments)
    & npx --prefix .venv_supabase supabase @Arguments
    return $LASTEXITCODE
}

Write-Host "🚀 Supabase Function Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Load expected project ID from .project-id if it exists
if (Test-Path .project-id) {
    $savedProjectId = (Get-Content .project-id -Raw).Trim()
    if ($savedProjectId) {
        $ExpectedProjectId = $savedProjectId
        Write-Host "📋 Using project ID from .project-id: $ExpectedProjectId" -ForegroundColor Gray
        Write-Host ""
    }
}

# Skip verification if flag is set
if ($SkipVerification) {
    Write-Host "⚠️  Skipping project verification (--SkipVerification flag set)" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "🔍 Verifying project link..." -ForegroundColor Yellow
    
    try {
        # Check if supabase CLI virtual environment exists
        if (-not (Test-Path .venv_supabase)) {
            Write-Host "❌ Error: Supabase CLI virtual environment not found" -ForegroundColor Red
            Write-Host "   Please run: mkdir .venv_supabase && cd .venv_supabase && npm init -y && npm install supabase --save-dev" -ForegroundColor Yellow
            exit 1
        }
        if (-not (Test-Path .venv_supabase\node_modules\supabase)) {
            Write-Host "❌ Error: Supabase CLI not installed in virtual environment" -ForegroundColor Red
            Write-Host "   Please run: cd .venv_supabase && npm install supabase --save-dev" -ForegroundColor Yellow
            exit 1
        }
        
        # Get current project status
        $statusOutput = Invoke-Supabase -Arguments @("status") 2>&1 | Out-String
        
        # Try to get linked project info
        $projectsOutput = Invoke-Supabase -Arguments @("projects", "list", "--output", "json") 2>&1 | Out-String
        $projects = $projectsOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        $currentProjectId = $null
        
        # Check if we can find the linked project
        if ($projects -and $projects.value) {
            # When linked, projects list shows the linked project
            # We need to check the actual link status differently
            # Try to get project info from status or link
            $linkInfo = Invoke-Supabase -Arguments @("link", "--help") 2>&1 | Out-String
        }
        
        # Alternative: Check .supabase directory or try to get project from API
        # For now, we'll check by trying to list functions and see which project they belong to
        try {
            $functionsOutput = Invoke-Supabase -Arguments @("functions", "list", "--output", "json") 2>&1 | Out-String
            if ($functionsOutput -and -not ($functionsOutput -match "error|Error|ERROR")) {
                $functions = $functionsOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($functions -and $functions.value) {
                    # Extract project ID from function URLs or metadata
                    # This is a fallback method
                }
            }
        } catch {
            # Ignore errors in function listing
        }
        
        # Most reliable method: Check environment or config
        # Check if we have a .supabase directory with project info
        if (Test-Path .supabase) {
            $configFiles = Get-ChildItem .supabase -Recurse -Filter "*.json" -ErrorAction SilentlyContinue
            foreach ($file in $configFiles) {
                try {
                    $config = Get-Content $file.FullName -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($config.project_ref -or $config.projectRef) {
                        $currentProjectId = $config.project_ref ?? $config.projectRef
                        break
                    }
                } catch {
                    # Ignore JSON parse errors
                }
            }
        }
        
        # If still no project ID found, try to get it from Supabase API or status
        if (-not $currentProjectId) {
            # Try a different approach: use supabase projects list and check for linked project
            # Or check the actual deployed functions URL
            Write-Host "⚠️  Could not automatically detect linked project" -ForegroundColor Yellow
            Write-Host "   Please verify manually:" -ForegroundColor Yellow
            Write-Host "   npx --prefix .venv_supabase supabase status" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   Or check the project dashboard URL in your browser" -ForegroundColor Yellow
            Write-Host ""
            
            $manualCheck = Read-Host "Continue with deployment? (y/N)"
            if ($manualCheck -ne "y" -and $manualCheck -ne "Y") {
                Write-Host "❌ Deployment cancelled" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "📌 Current linked project: $currentProjectId" -ForegroundColor Cyan
            Write-Host "🎯 Expected project: $ExpectedProjectId" -ForegroundColor Cyan
            Write-Host ""
            
            if ($currentProjectId -ne $ExpectedProjectId) {
                Write-Host "❌ WRONG PROJECT LINKED!" -ForegroundColor Red
                Write-Host ""
                Write-Host "   Current:  $currentProjectId" -ForegroundColor Red
                Write-Host "   Expected: $ExpectedProjectId" -ForegroundColor Green
                Write-Host ""
                Write-Host "🔧 To fix:" -ForegroundColor Yellow
                Write-Host "   1. npx --prefix .venv_supabase supabase unlink" -ForegroundColor White
                Write-Host "   2. npx --prefix .venv_supabase supabase link --project-ref $ExpectedProjectId" -ForegroundColor White
                Write-Host ""
                exit 1
            } else {
                Write-Host "✅ Correct project linked!" -ForegroundColor Green
                Write-Host ""
            }
        }
        
    } catch {
        Write-Host "⚠️  Warning: Could not verify project link" -ForegroundColor Yellow
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Continuing with deployment, but please verify manually:" -ForegroundColor Yellow
        Write-Host "   npx --prefix .venv_supabase supabase status" -ForegroundColor Gray
        Write-Host ""
        
        $continue = Read-Host "Continue with deployment? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "❌ Deployment cancelled" -ForegroundColor Red
            exit 1
        }
    }
}

# Deploy the function
Write-Host "📦 Deploying function: $FunctionName" -ForegroundColor Cyan
Write-Host ""

try {
    $exitCode = 0
    if ($ExpectedProjectId) {
        Write-Host "   Using explicit project ref: $ExpectedProjectId" -ForegroundColor Gray
        $exitCode = Invoke-Supabase -Arguments @("functions", "deploy", $FunctionName, "--project-ref", $ExpectedProjectId)
    } else {
        $exitCode = Invoke-Supabase -Arguments @("functions", "deploy", $FunctionName)
    }
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 View in dashboard:" -ForegroundColor Cyan
        Write-Host "   https://supabase.com/dashboard/project/$ExpectedProjectId/functions" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed (exit code: $exitCode)" -ForegroundColor Red
        exit $exitCode
    }
} catch {
    Write-Host ""
    Write-Host "❌ Deployment error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

