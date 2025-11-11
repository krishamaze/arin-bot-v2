# Deployment Guide

## How It Works

**No browser login needed!** Uses `SUPABASE_ACCESS_TOKEN` from `.env` file.

The Supabase CLI automatically uses the `SUPABASE_ACCESS_TOKEN` environment variable when it's set. We just load it from `.env` before running commands.

## Quick Deploy

### Prerequisites

1. Create `.env` file in project root:
```env
SUPABASE_ACCESS_TOKEN=your_access_token_here
```

Get your access token from: https://supabase.com/dashboard/account/tokens

Copy `.env.example` to `.env` and fill in your token.

### Deploy Everything

```bash
npm run deploy
```

Or manually:
```powershell
powershell -File scripts/deploy-to-cloud.ps1
```

### Deploy Migrations Only

```bash
npm run deploy:db
```

### Deploy Functions Only

```bash
npm run deploy:functions
```

### Manual Commands

If you need to run commands manually, load the token first:

```powershell
# Load token from .env
$env:SUPABASE_ACCESS_TOKEN = (Get-Content .env | Where-Object { $_ -match 'SUPABASE_ACCESS_TOKEN\s*=' } | ForEach-Object { if ($_ -match '=\s*(.+)') { $matches[1].Trim() } })

# Then run Supabase commands
npx supabase db push --linked --include-all --yes
npx supabase functions deploy chat-api-v2 --project-ref opaxtxfxropmjrrqlewh
```

## Troubleshooting

**"Access token not provided" error:**
1. Check `.env` file exists and has `SUPABASE_ACCESS_TOKEN=...`
2. Make sure token is valid (get new one from dashboard if expired)
3. Run the token loading command before each deploy command

**Token expired:**
- Get a new token from: https://supabase.com/dashboard/account/tokens
- Update `.env` file with the new token
