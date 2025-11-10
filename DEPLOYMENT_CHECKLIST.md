# Wingman Deployment Checklist

## Prerequisites

- [ ] Supabase CLI installed (✅ Verified: v2.54.11)
- [ ] Logged in to Supabase CLI
- [ ] Project linked to cloud
- [ ] Environment variables set
- [ ] Migration file ready
- [ ] Edge function code ready

## Step 1: Login and Link Project

```powershell
# Login to Supabase
supabase login

# Link to project (project reference: opaxtxfxropmjrrqlewh)
supabase link --project-ref opaxtxfxropmjrrqlewh
```

## Step 2: Verify Migration File

```powershell
# Check migration file exists
Test-Path supabase/migrations/20251109000000_wingman_schema.sql

# Review migration file
Get-Content supabase/migrations/20251109000000_wingman_schema.sql | Select-Object -First 50
```

## Step 3: Deploy Migration

```powershell
# Option A: Use deployment script
.\scripts\deploy-wingman-v2.ps1 -SkipFunction

# Option B: Manual deployment
supabase db push
```

## Step 4: Verify Schema

```powershell
# Verify schema deployment
.\scripts\verify-wingman-schema.ps1
```

## Step 5: Deploy Edge Function

```powershell
# Option A: Use deployment script
.\scripts\deploy-wingman-v2.ps1 -SkipMigration

# Option B: Manual deployment
supabase functions deploy chat-api-v2
```

## Step 6: Set Environment Variables

Set in Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add environment variables:
   - `SUPABASE_URL` (auto-set)
   - `SUPABASE_SERVICE_ROLE_KEY` (auto-set)
   - `GEMINI_API_KEY` (manual)

## Step 7: Test Endpoints

```powershell
# Test all endpoints
.\scripts\test-wingman-v2.ps1 -TestAll

# Test individual endpoints
.\scripts\test-wingman-v2.ps1 -TestInit
.\scripts\test-wingman-v2.ps1 -TestAnalysis
```

## Step 8: Verify Function

```powershell
# List functions
supabase functions list

# Check function logs
supabase functions logs chat-api-v2
```

## Current Status

- ✅ Supabase CLI installed
- ⏳ Need to login
- ⏳ Need to link project
- ⏳ Ready to deploy migration
- ⏳ Ready to deploy function

