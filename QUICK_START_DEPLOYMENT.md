# Quick Start Deployment

## Prerequisites Check

✅ Supabase CLI installed (v2.54.11)
✅ Migration file ready
✅ Edge function code ready
⏳ Need to login to Supabase

## Step 1: Login to Supabase

**Run this command in your terminal:**

```powershell
supabase login
```

**What happens:**
1. Press Enter when prompted
2. Browser opens automatically
3. Login to Supabase
4. Return to terminal - login completes automatically

**Verify login:**
```powershell
supabase projects list
```

## Step 2: Link Project

**Run this command:**

```powershell
supabase link --project-ref opaxtxfxropmjrrqlewh
```

## Step 3: Deploy Migration

**Run this command:**

```powershell
supabase db push
```

**Expected output:**
- Migration applied successfully
- Tables created: users, conversations, messages, bot_suggestions
- Indexes created

## Step 4: Set Environment Variables

**In Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/opaxtxfxropmjrrqlewh/settings/functions
2. Edge Functions → Environment Variables
3. Add: `GEMINI_API_KEY` = your-api-key
4. Save

## Step 5: Deploy Function

**Run this command:**

```powershell
supabase functions deploy chat-api-v2
```

**Expected output:**
- Function deployed successfully
- Function URL: https://opaxtxfxropmjrrqlewh.supabase.co/functions/v1/chat-api-v2

## Step 6: Test

**Run this command:**

```powershell
.\scripts\test-wingman-v2.ps1 -TestAll
```

## Done! 🎉

Your Wingman Dating Helper is now deployed and ready to use!

## Next: Test Client

See `chrome-extension/README.md` for Chrome extension setup, or use the console script in `client/fftBot-client.js`.

