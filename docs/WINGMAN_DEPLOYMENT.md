# Wingman Deployment Guide

*Last updated: 2025-11-09*

Complete deployment guide for the Wingman Dating Chat Helper.

## Prerequisites

1. **Supabase CLI** installed and configured
2. **Project linked** to Supabase cloud project
3. **Environment variables** set (`.env` file or system env)
4. **Git** repository (for version control)

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] Verify migration file exists: `supabase/migrations/20251109000000_wingman_schema.sql`
- [ ] Verify edge function exists: `supabase/functions/chat-api-v2/index.ts`
- [ ] Verify `_shared` folder structure is correct
- [ ] Check environment variables are set
- [ ] Backup existing database (if needed)

### 2. Deploy Database Migration

```powershell
# Windows PowerShell
.\scripts\deploy-wingman-v2.ps1 -SkipFunction

# Or manually
supabase db push
```

**What this does:**
- Creates `users` table with JSONB indexes
- Creates `conversations` table with nullable `match_user_id`
- Creates `messages` table with sentiment tracking
- Creates `bot_suggestions` table for analytics
- Creates all necessary indexes (GIN, B-tree, partial)

**Verification:**
```powershell
.\scripts\verify-wingman-schema.ps1
```

### 3. Deploy Edge Function

```powershell
# Windows PowerShell
.\scripts\deploy-wingman-v2.ps1 -SkipMigration

# Or manually
supabase functions deploy chat-api-v2
```

**What this does:**
- Deploys `chat-api-v2` edge function
- Bundles `_shared` folder utilities
- Sets up environment variables
- Creates function endpoints

**Verification:**
```powershell
supabase functions list
# Should show chat-api-v2 in the list
```

### 4. Test Endpoints

```powershell
# Test initialization
.\scripts\test-wingman-v2.ps1 -TestInit

# Test analysis
.\scripts\test-wingman-v2.ps1 -TestAnalysis

# Test all
.\scripts\test-wingman-v2.ps1 -TestAll
```

### 5. Update Client

#### Option A: Chrome Extension (Recommended)
1. Load extension in Chrome
2. Update `EDGE_URL` in `chrome-extension/content.js` if needed
3. Test on Free4Talk

#### Option B: Console Script
1. Update `EDGE_URL` in `client/fftBot-client.js`
2. Inject script in browser console
3. Test on Free4Talk

## Environment Variables

Required environment variables for edge function:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

Set in Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add environment variables
3. Redeploy function if needed

## API Endpoints

### POST `/v1/chat-api-v2/init`

Initialize Wingman for a user.

**Request:**
```json
{
  "platformId": "user-123",
  "username": "John Doe",
  "roomPath": "/room/123"
}
```

**Response:**
```json
{
  "conversationId": "uuid",
  "userId": "user-123",
  "status": "initialized"
}
```

### POST `/v1/chat-api-v2/`

Get Wingman suggestions.

**Request:**
```json
{
  "conversationId": "uuid",
  "userId": "user-123",
  "girlId": "girl-456",
  "girlName": "Jane",
  "recentMessages": [
    {
      "sender": "girl",
      "text": "Hey! How are you?",
      "timestamp": 1234567890
    }
  ]
}
```

**Response:**
```json
{
  "analysis": {
    "her_last_message_feeling": "curious",
    "conversation_vibe": "warm and engaging",
    "recommended_goal": "build rapport"
  },
  "suggestions": [
    {
      "type": "Playful/Humorous",
      "text": "I'm doing great! Just finished work, how about you?",
      "rationale": "Shows interest and asks a follow-up question"
    },
    {
      "type": "Curious/Engaging",
      "text": "Pretty good! What are you up to today?",
      "rationale": "Asks an open-ended question to continue conversation"
    },
    {
      "type": "Direct/Confident",
      "text": "Doing well! Been thinking about our conversation earlier",
      "rationale": "Shows you're engaged and remember details"
    }
  ],
  "wingman_tip": "Try to ask open-ended questions to keep the conversation flowing"
}
```

## Monitoring

### Function Logs

```powershell
# View function logs
supabase functions logs chat-api-v2

# Follow logs in real-time
supabase functions logs chat-api-v2 --follow
```

### Database Queries

```sql
-- Check cache hit rate
SELECT 
  COUNT(*) as total_suggestions,
  COUNT(*) FILTER (WHERE cached_tokens > 0) as cached_requests,
  AVG(response_time_ms) as avg_response_time,
  AVG(cached_tokens) as avg_cached_tokens
FROM bot_suggestions
WHERE created_at > now() - interval '24 hours';

-- Check conversation status
SELECT 
  conversation_status,
  COUNT(*) as count
FROM conversations
GROUP BY conversation_status;

-- Check user types
SELECT 
  user_type,
  COUNT(*) as count
FROM users
GROUP BY user_type;
```

### Performance Metrics

Key metrics to monitor:
- **Cache hit rate**: Should be > 80%
- **Response time**: Should be < 2s (likely < 1s with caching)
- **Token usage**: Cached tokens should reduce costs by > 75%
- **Error rate**: Should be < 1%

## Rollback Plan

### Rollback Database Migration

```sql
-- Rollback migration (run in Supabase SQL Editor)
DROP TABLE IF EXISTS bot_suggestions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### Rollback Edge Function

```powershell
# Keep v1 function active
# Disable v2 function (or delete)
supabase functions delete chat-api-v2

# Update client to use v1 endpoint
# EDGE_URL: https://your-project.supabase.co/functions/v1/chat-api
```

## Troubleshooting

### Migration Fails

**Error: Table already exists**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'conversations', 'messages', 'bot_suggestions');

-- Drop tables if needed (CAUTION: Deletes all data)
DROP TABLE IF EXISTS bot_suggestions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### Function Deployment Fails

**Error: Module not found**
- Check `_shared` folder exists
- Verify import paths in `index.ts`
- Check `deno.json` configuration

**Error: Environment variable not found**
- Set variables in Supabase Dashboard
- Redeploy function after setting variables

### Cache Not Working

**Symptoms:**
- `cached_tokens` is always 0
- Response times are slow
- High token usage

**Solutions:**
- Check Gemini API key is valid
- Verify cache creation in logs
- Check cache TTL settings
- Verify cache key format

### Validation Errors

**Error: Invalid conversation ID**
- Check UUID format
- Verify conversation exists in database
- Check Zod schema validation

**Error: Missing required fields**
- Verify request body structure
- Check Zod schema requirements
- Review error response for details

## Success Criteria

Deployment is successful when:
- [ ] All tables created with correct schema
- [ ] All indexes created and working
- [ ] Edge function deployed and accessible
- [ ] `/init` endpoint returns conversation ID
- [ ] Analysis endpoint returns valid suggestions
- [ ] Cache hit rate > 80%
- [ ] Response time < 2s
- [ ] Client can connect and receive suggestions
- [ ] No errors in function logs

## Next Steps

After successful deployment:
1. Monitor function logs for errors
2. Check cache hit rate and performance
3. Gather user feedback
4. Optimize based on metrics
5. Plan v2.1 improvements

## Support

For issues or questions:
1. Check function logs
2. Review database queries
3. Test endpoints with test script
4. Check environment variables
5. Review documentation

## References

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Database Schema](./WINGMAN_SCHEMA.md)
- [API Documentation](./API_DOCUMENTATION.md)

