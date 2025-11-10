# Deployment Guide - Wingman Extension v2

**Date**: 2025-01-21  
**Version**: 2.1.0

## Overview

Complete deployment guide for the new Wingman extension with cleanup of old functions and tables.

## Prerequisites

- Supabase CLI installed
- Supabase project linked
- Environment variables configured
- Chrome extension built

## Step-by-Step Deployment

### 1. Pre-Deployment Checklist

- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Project linked (`supabase link --project-ref YOUR_PROJECT_REF`)
- [ ] Environment variables set in Supabase Dashboard:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `PROMPT_SOURCE` (optional, defaults to 'yaml')
  - `PROMPT_VERSION` (optional)

### 2. Deploy Database Migrations

```bash
# Apply all migrations (including new prompts table and cleanup)
supabase db push
```

This will:
- ✅ Create `prompts` table for versioning
- ✅ Remove unused tables (events, response_threads, analytics, etc.)
- ✅ Keep all required tables for chat-api-v2

### 3. Deploy Edge Function

```bash
# Deploy chat-api-v2 function
supabase functions deploy chat-api-v2
```

Verify deployment:
```bash
supabase functions list
```

### 4. Remove Old Function (Manual)

The old `chat-api` function must be removed manually:

1. Go to Supabase Dashboard
2. Navigate to: **Edge Functions**
3. Find `chat-api` function
4. Click **Delete** (or disable if you want to keep for reference)

**Why manual?** Supabase CLI doesn't have a delete function command.

### 5. Verify Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Check required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'conversations', 'messages', 'bot_suggestions', 'prompts',
  'bots', 'rooms', 'user_room_summaries', 'user_and_bot_room_summaries',
  'user_and_bot_global_summaries', 'room_summaries'
)
ORDER BY table_name;
```

Should return 11 tables.

### 6. Test Extension

1. Load extension in Chrome (Developer mode)
2. Navigate to Free4Talk
3. Type `wingman/` to activate
4. Chat with someone
5. Verify suggestions appear

### 7. Monitor Logs

Check edge function logs:
```bash
supabase functions logs chat-api-v2
```

Or in Dashboard: **Edge Functions > chat-api-v2 > Logs**

## Automated Deployment

Use the provided script:

```powershell
# Full deployment with cleanup
.\scripts\deploy-cleanup.ps1

# Dry run (no changes)
.\scripts\deploy-cleanup.ps1 -DryRun
```

## Rollback Plan

If issues occur:

1. **Re-deploy old function** (if you kept it):
   ```bash
   supabase functions deploy chat-api
   ```

2. **Revert migration** (if needed):
   ```bash
   supabase migration repair
   ```

3. **Restore from backup** (if available):
   - Use Supabase Dashboard > Database > Backups

## Post-Deployment Verification

### Extension Tests
- [ ] Extension loads without errors
- [ ] `wingman/` command activates bot
- [ ] Messages are detected
- [ ] Suggestions are generated
- [ ] Single suggestion displays correctly
- [ ] Error handling works
- [ ] Girl detection updates correctly

### Backend Tests
- [ ] `/init` endpoint works
- [ ] Main analysis endpoint works
- [ ] User summaries are fetched
- [ ] Tone level is calculated
- [ ] Prompt versioning works
- [ ] Suggestions are stored in database

### Database Tests
- [ ] Messages are stored in `messages` table
- [ ] Suggestions are stored in `bot_suggestions` table
- [ ] Prompt version and tone_level are logged
- [ ] User summaries are accessible

## Troubleshooting

### Extension not connecting
- Check `EDGE_URL` in content.js matches deployed function
- Verify CORS headers in edge function
- Check browser console for errors

### No suggestions generated
- Check edge function logs
- Verify GEMINI_API_KEY is set
- Check prompt versioning is working
- Verify user summaries exist

### Database errors
- Check migrations applied correctly
- Verify required tables exist
- Check foreign key constraints

## Cleanup Summary

### Removed
- ❌ `chat-api` edge function
- ❌ `events` table (replaced by `messages`)
- ❌ `response_threads` table
- ❌ `analytics` table
- ❌ `embeddings` table
- ❌ `feature_flags` table
- ❌ `bot_configs` table

### Kept
- ✅ `chat-api-v2` edge function
- ✅ All tables used by chat-api-v2
- ✅ Summary tables for context
- ✅ Prompt versioning system

## Next Steps

1. Monitor extension usage
2. Collect feedback on single suggestion format
3. A/B test prompt versions
4. Optimize based on tone_level data
5. Consider re-adding analytics if needed

## Support

- Check logs: `supabase functions logs chat-api-v2`
- Review code: `supabase/functions/chat-api-v2/`
- Extension code: `chrome-extension/content.js`
