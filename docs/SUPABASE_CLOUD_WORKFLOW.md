# Supabase Cloud-Only Development Workflow

This guide covers **cloud-only development** using Supabase CLI with transaction pooler. No Docker required.

## Overview

- ✅ **Cloud-only**: Work directly against cloud Supabase project
- ✅ **No Docker**: No local Supabase instance needed
- ✅ **Transaction Pooler**: Use pooled connections for better performance
- ✅ **CLI Auth**: Uses ACCESS_TOKEN for CLI operations
- ✅ **App Auth**: Uses ANON_KEY for runtime operations

## Prerequisites

- Node.js (v18+)
- Supabase CLI (installed via `npm install`)
- Supabase account and project
- Access token for CLI authentication

## Authentication

### CLI Authentication (ACCESS_TOKEN)

The Supabase CLI uses `ACCESS_TOKEN` for authenticating with Supabase API.

#### Method 1: Login via CLI (Recommended)

```bash
npm run supabase:login
```

This opens a browser for authentication and stores the token securely.

#### Method 2: Environment Variable

```bash
# macOS/Linux
export SUPABASE_ACCESS_TOKEN=your_access_token_here

# Windows PowerShell
$env:SUPABASE_ACCESS_TOKEN="your_access_token_here"

# Windows CMD
set SUPABASE_ACCESS_TOKEN=your_access_token_here
```

**Get your access token**: https://supabase.com/dashboard/account/tokens

### App Runtime Authentication (ANON_KEY)

Your application uses `SUPABASE_ANON_KEY` for runtime operations:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

**Get these from**: Supabase Dashboard → Settings → API

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate CLI

```bash
# Login via CLI
npm run supabase:login

# Or set ACCESS_TOKEN
export SUPABASE_ACCESS_TOKEN=your_access_token_here
```

### 3. Link Project

```bash
# Link to your Supabase project
npm run supabase:link
# Project ref: opaxtxfxropmjrrqlewh
```

### 4. Verify Connection

```bash
# Check project status
npm run supabase:status
```

### 5. Pull Schema

```bash
# Pull current schema from cloud
npm run supabase:pull
```

This creates migration files in `supabase/migrations/` based on your cloud database.

### 6. Generate Types

```bash
# Generate TypeScript types from cloud schema
npm run supabase:types
```

## Development Workflow

### Create Migration

#### Option 1: Manual Migration

```bash
# Create new migration file
npm run supabase:migration:new add_feature_name

# Edit migration file in supabase/migrations/
# Then push to cloud
npm run supabase:push
```

#### Option 2: Generate from Diff

```bash
# Generate migration from schema changes
npm run supabase:diff

# Review generated migration
# Then push to cloud
npm run supabase:push
```

### Apply Migration

```bash
# Push migration to cloud
npm run supabase:push
```

### Check Migration Status

```bash
# List all migrations and their status
npm run supabase:migration:list
```

### Regenerate Types

After schema changes, regenerate TypeScript types:

```bash
npm run supabase:types
```

## Database Connection

### Transaction Pooler

This project uses the **transaction pooler** for database connections:

- **Port**: 5432
- **Connection String**: Available in Dashboard → Settings → Database → Connection Pooling
- **Mode**: Transaction (recommended for serverless)

**Benefits**:
- Better connection management
- Reduced connection overhead
- Improved performance for serverless functions
- Automatic connection pooling

### Connection String Format

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true
```

Get the connection string from: Supabase Dashboard → Settings → Database → Connection Pooling

### Direct Connection (Alternative)

For direct database access (not recommended for production):

```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Login | `npm run supabase:login` | Authenticate with Supabase CLI |
| Link | `npm run supabase:link` | Link to cloud project |
| Status | `npm run supabase:status` | Check project status |
| Push | `npm run supabase:push` | Push migrations to cloud |
| Pull | `npm run supabase:pull` | Pull schema from cloud |
| Diff | `npm run supabase:diff` | Generate migration from diff |
| Migration New | `npm run supabase:migration:new <name>` | Create new migration |
| Migration List | `npm run supabase:migration:list` | List all migrations |
| Types | `npm run supabase:types` | Generate TypeScript types |
| Logs | `npm run supabase:logs` | View cloud logs |
| Inspect | `npm run supabase:inspect:db` | Inspect database |
| Studio | `npm run supabase:studio` | Open Supabase Studio |
| Functions Deploy | `npm run supabase:functions:deploy <name>` | Deploy Edge Function |
| Functions Serve | `npm run supabase:functions:serve` | Serve functions locally |

## Environment Variables

### Required for CLI

- `SUPABASE_ACCESS_TOKEN` - For CLI authentication (optional if using `supabase login`)

### Required for App

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Anonymous key for client-side operations

### Optional

- `OPENAI_API_KEY` - For OpenAI integration
- `GEMINI_API_KEY` - For Gemini integration

### Example `.env` File

```env
# Supabase Project
SUPABASE_URL=https://opaxtxfxropmjrrqlewh.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# CLI Authentication (optional if using 'supabase login')
# SUPABASE_ACCESS_TOKEN=your_access_token_here

# API Keys
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
```

## Migration Workflow

### Standard Workflow

1. **Create Migration**
   ```bash
   npm run supabase:migration:new add_feature
   ```

2. **Edit Migration File**
   ```sql
   -- supabase/migrations/20250109120000_add_feature.sql
   CREATE TABLE new_table (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Push to Cloud**
   ```bash
   npm run supabase:push
   ```

4. **Regenerate Types**
   ```bash
   npm run supabase:types
   ```

### Diff-Based Workflow

1. **Make Schema Changes** (via Studio or direct SQL)
2. **Generate Migration**
   ```bash
   npm run supabase:diff
   ```
3. **Review Generated Migration**
4. **Push to Cloud**
   ```bash
   npm run supabase:push
   ```

## Edge Functions

### Deploy Function

```bash
# Deploy specific function
npm run supabase:functions:deploy chat-api-v2

# Deploy all functions
npm run supabase:functions:deploy
```

### Serve Locally

```bash
# Serve functions locally for testing
npm run supabase:functions:serve

# Functions available at:
# http://localhost:54321/functions/v1/chat-api-v2
```

### Function Environment Variables

Set function secrets:

```bash
# Set secret for function
npx supabase secrets set MY_SECRET=my_value --linked

# List secrets
npx supabase secrets list --linked
```

## Monitoring & Debugging

### View Logs

```bash
# View all logs
npm run supabase:logs

# View specific function logs
npx supabase functions logs chat-api-v2 --linked
```

### Inspect Database

```bash
# Inspect database stats
npm run supabase:inspect:db

# Inspect specific table
npx supabase inspect db table-stats --linked --table your_table
```

### Open Studio

```bash
# Open Supabase Studio in browser
npm run supabase:studio
```

## Best Practices

1. ✅ **Always use `--linked` flag** - Ensures operations target correct project
2. ✅ **Review migrations before pushing** - Double-check SQL before applying
3. ✅ **Generate types after schema changes** - Keep TypeScript types in sync
4. ✅ **Use transaction pooler** - Better performance for serverless
5. ✅ **Never commit ACCESS_TOKEN** - Use `supabase login` or env var
6. ✅ **Use ANON_KEY for app runtime** - Never use SERVICE_ROLE_KEY in client code
7. ✅ **Test migrations on staging** - Test before applying to production
8. ✅ **Monitor logs regularly** - Check for errors and performance issues

## Troubleshooting

### "Project not linked"

```bash
# Link to project
npm run supabase:link
```

### "Authentication failed"

```bash
# Re-authenticate
npm run supabase:login

# Or set ACCESS_TOKEN
export SUPABASE_ACCESS_TOKEN=your_access_token_here
```

### "Migration failed"

```bash
# Check migration status
npm run supabase:migration:list

# View logs
npm run supabase:logs
```

### "Types not updating"

```bash
# Regenerate types from cloud
npm run supabase:types
```

### "Connection timeout"

- Check transaction pooler is enabled
- Verify connection string is correct
- Check network connectivity
- Verify database is running

## Security

### ACCESS_TOKEN vs ANON_KEY

- **ACCESS_TOKEN**: Used by CLI for administrative operations
  - Never commit to git
  - Store securely (use `supabase login` or env var)
  - Only needed for CLI operations

- **ANON_KEY**: Used by application for runtime operations
  - Safe to use in client-side code
  - Respects Row Level Security (RLS)
  - Limited permissions

### SERVICE_ROLE_KEY

- **Never use in client-side code**
- Only use in server-side Edge Functions
- Bypasses Row Level Security
- Store securely as secret

## Project-Specific Notes

- **Project Reference**: `opaxtxfxropmjrrqlewh`
- **Transaction Pooler**: Enabled (port 5432)
- **Migration files**: `supabase/migrations/`
- **Types output**: `supabase/types/database.ts`
- **CLI version**: Locked in `package.json` devDependencies

## Quick Reference

### Setup (One-Time)

```bash
npm install
npm run supabase:login
npm run supabase:link
npm run supabase:pull
npm run supabase:types
```

### Daily Workflow

```bash
# Create migration
npm run supabase:migration:new add_feature

# Push to cloud
npm run supabase:push

# Generate types
npm run supabase:types

# View logs
npm run supabase:logs
```

### Environment Variables

**Required for CLI**:
- `SUPABASE_ACCESS_TOKEN` (or use `supabase login`)

**Required for App**:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**Never use SERVICE_ROLE_KEY in client-side code!**

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Transaction Pooler Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)

---

For local development workflow (with Docker), see [SUPABASE_CLI_GUIDE.md](./SUPABASE_CLI_GUIDE.md).

