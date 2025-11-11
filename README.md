# Arin Bot v2 - Wingman Dating Helper

AI-powered dating assistant that provides real-time conversation suggestions using Supabase Edge Functions and Gemini AI.

## Quick Start

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```env
   SUPABASE_ACCESS_TOKEN=your_access_token_here
   ```
   Get token from: https://supabase.com/dashboard/account/tokens

### Deploy

```bash
npm run deploy
```

Or manually:
```powershell
powershell -File scripts/deploy-to-cloud.ps1
```

See [DEPLOY.md](DEPLOY.md) for detailed deployment instructions.

## Features

- **Group Chat Support**: Auto-detects one-on-one vs group conversations
- **Gender Detection**: Infers and tracks user gender from conversations
- **Relationship Tracking**: Maintains separate relationship summaries per person
- **Real-time Suggestions**: Provides contextual reply suggestions based on conversation history
- **Chrome Extension**: Browser extension for seamless integration

## Project Structure

```
├── supabase/
│   ├── functions/
│   │   ├── chat-api-v2/      # Main Wingman API (v2)
│   │   └── _shared/          # Shared utilities
│   └── migrations/           # Database migrations
├── chrome-extension/         # Browser extension
├── scripts/                  # Deployment and utility scripts
└── DEPLOY.md                 # Deployment guide
```

## Documentation

- [DEPLOY.md](DEPLOY.md) - Deployment instructions
- [docs/WINGMAN_SCHEMA.md](docs/WINGMAN_SCHEMA.md) - Database schema reference

## Development

### Local Testing

```bash
# Test edge function locally
npm run supabase:functions:serve
```

### Database Migrations

```bash
# Create new migration
npm run supabase:migration:new migration_name

# Push to cloud
npm run deploy:db
```

## License

See [LICENSE](LICENSE) file.
