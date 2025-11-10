# Supabase CLI Guide — Local First Development

This guide covers **local development** for safe, offline testing before pushing to cloud.

> **Note**: For cloud-only development workflow (no Docker required), see [SUPABASE_CLOUD_WORKFLOW.md](./SUPABASE_CLOUD_WORKFLOW.md).

## Why Local First?

- ✅ **Safe**: Local changes don't affect production
- ✅ **Offline**: Develop without internet connection
- ✅ **Fast**: No network latency
- ✅ **Free**: No API usage costs
- ✅ **Isolated**: Multiple developers can work simultaneously
- ✅ **Testable**: Reset database easily for testing

## Prerequisites

- Docker Desktop (required for local Supabase)
- Node.js (v18+)
- Supabase CLI (installed via `npm install`)

## Quick Start

```bash
# Install dependencies
npm install

# Start local Supabase
npm run supabase:start

# Apply migrations
npm run supabase:push

# Seed test data
npm run supabase:seed

# Generate types
npm run supabase:types

# Open Studio
npm run supabase:studio
```

## Local First Workflow

### 1. Start Local Supabase

```bash
npm run supabase:start
```

This spins up a local Supabase instance using Docker with:
- PostgreSQL database
- Supabase API
- Supabase Studio
- Auth, Storage, Realtime services

**Ports** (configured in `supabase/config.toml`):
- API: `65430`
- Database: `65431`
- Studio: `65433`
- Shadow DB: `65432`

### 2. Check Status

```bash
npm run supabase:status
```

Shows local Supabase URLs and auto-generated keys:
- API URL
- DB URL
- Studio URL
- Anon key
- Service role key

### 3. Development Loop

#### Create Migration

```bash
# Generate migration from schema changes
npm run supabase:diff

# Or create new migration manually
npx supabase migration new add_feature
```

#### Apply to Local

```bash
# Push migrations to local database
npm run supabase:push
```

#### Seed Test Data

```bash
# Reset and seed database
npm run supabase:seed

# Or just reset (no seed)
npx supabase db reset
```

#### Generate Types

```bash
# Generate TypeScript types from local schema
npm run supabase:types
```

#### Test RLS Policies

```bash
# Run RLS tests
npm run supabase:test:rls
```

### 4. View Logs

```bash
# Follow database logs
npm run supabase:logs
```

### 5. Open Studio

```bash
# Open Supabase Studio in browser
npm run supabase:studio
```

## Migrations 101

### Safe Migration Loop

1. **Edit SQL/Schema** → Make your schema changes
2. **Generate Migration** → `npm run supabase:diff` (creates migration file)
3. **Apply Locally** → `npm run supabase:push` (applies to local DB)
4. **Seed Data** → `npm run supabase:seed` (optional test data)
5. **Validate RLS** → `npm run supabase:test:rls` (test policies)
6. **Test Application** → Verify everything works
7. **Push to Cloud** → `npx supabase db push --linked` (only when ready)

### Create New Migration

```bash
# Auto-generate from schema diff
npm run supabase:diff

# Or create empty migration
npx supabase migration new migration_name
```

### Apply Migrations

```bash
# Apply to local database
npm run supabase:push

# Apply to cloud (after linking)
npx supabase db push --linked
```

### Check Migration Status

```bash
# List all migrations
npx supabase migration list
```

Shows:
- ✓ Applied migrations
- pending migrations
- local-only migrations

### Pull Schema from Remote

```bash
# Pull remote schema (creates migration)
npm run supabase:pull
```

## RLS Cookbook

### Common RLS Patterns

#### 1. Users can only see their own data

```sql
CREATE POLICY "Users can view own data"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id);
```

#### 2. Users can insert their own data

```sql
CREATE POLICY "Users can insert own data"
  ON your_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 3. Public read, authenticated write

```sql
CREATE POLICY "Public read access"
  ON your_table FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated write access"
  ON your_table FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

#### 4. Team-based access

```sql
CREATE POLICY "Team members can view team data"
  ON your_table FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM team_members
      WHERE team_id = your_table.team_id
    )
  );
```

### Testing RLS

Create test queries in `tests/rls/run.sql`:

```sql
-- Test positive case (should return rows)
SELECT * FROM your_table WHERE user_id = auth.uid();

-- Test negative case (should return empty)
SELECT * FROM your_table WHERE user_id != auth.uid();
```

Run tests:

```bash
npm run supabase:test:rls
```

## Ports & Collision Resolution

### Current Port Configuration

This project uses custom ports (65430-65437) to avoid conflicts:

- API: `65430`
- Database: `65431`
- Shadow DB: `65432`
- Studio: `65433`
- Inbucket: `65434`
- Analytics: `65435`
- Pooler: `65436`
- Inspector: `65437`

### Changing Ports

Edit `supabase/config.toml`:

```toml
[api]
port = 54321  # Change API port

[db]
port = 54322  # Change DB port

[studio]
port = 54323  # Change Studio port
```

### Port Collision Troubleshooting

If ports are already in use:

1. **Check what's using the port:**
   ```bash
   # Windows
   netstat -ano | findstr :65430
   
   # macOS/Linux
   lsof -i :65430
   ```

2. **Change ports in config.toml** (see above)

3. **Restart Supabase:**
   ```bash
   npm run supabase:stop
   npm run supabase:start
   ```

## Cloud Push Rules

### When to Push to Cloud

**Only push to cloud after:**
- ✅ Migrations tested locally
- ✅ RLS policies validated
- ✅ Application tested
- ✅ Types generated and verified

### Linking Project (One-Time)

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref opaxtxfxropmjrrqlewh
```

### Pushing to Cloud

```bash
# Push migrations to cloud
npx supabase db push --linked

# Verify push
npx supabase migration list --linked
```

**Important**: Always use `--linked` flag for cloud operations to avoid accidents.

### Generating Types from Cloud

```bash
# Generate types from cloud schema
npx supabase gen types typescript --linked > supabase/types/database.ts
```

## Recovery Procedures

### Hard Reset (Local Only)

**Warning**: This destroys all local data.

```bash
# macOS/Linux
CONFIRM_RESET=true npm run supabase:reset:hard

# Windows PowerShell
$env:CONFIRM_RESET="true"; npm run supabase:reset:hard

# Windows CMD
set CONFIRM_RESET=true && npm run supabase:reset:hard
```

The script requires:
1. `CONFIRM_RESET=true` environment variable
2. Type "yes" confirmation

### Reseed Database

```bash
# Reset and reseed
npm run supabase:seed
```

### Database Snapshot (Backup)

Before risky changes, create a snapshot:

```bash
# Create backup
npx supabase db dump --local --file backups/local-$(date +%F-%H%M).sql

# Restore from backup
npx supabase db reset --file backups/local-2025-01-09-1400.sql
```

## Environment Variables

### Local Development

For local development, use `.env.local`:

```env
# Local Supabase (auto-generated by 'supabase start')
SUPABASE_URL=http://localhost:65430
SUPABASE_ANON_KEY=<check 'npm run supabase:status'>
SUPABASE_SERVICE_ROLE_KEY=<check 'npm run supabase:status'>

# API Keys (same as cloud)
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

**Never store SERVICE_ROLE_KEY in .env.local for production use.**

### Cloud Deployment

For cloud, use `.env.cloud` (git-ignored):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Environment Detection

In your code, detect environment:

```typescript
const isLocal = process.env.NODE_ENV === 'development' || 
                process.env.VITE_ENV === 'local';

const supabaseUrl = isLocal 
  ? 'http://localhost:65430'
  : process.env.SUPABASE_URL;
```

## TypeScript Types

### Generate Types

```bash
# From local schema
npm run supabase:types

# From cloud schema
npx supabase gen types typescript --linked > supabase/types/database.ts
```

### Using Types

```typescript
import { Database } from '../supabase/types/database';

type Tables = Database['public']['Tables'];
type Profiles = Tables['profiles']['Row'];
```

## FAQ

### Studio won't open

**Solution:**
1. Check if Supabase is running: `npm run supabase:status`
2. Check port 65433 is not in use
3. Restart: `npm run supabase:stop && npm run supabase:start`

### PostgreSQL is busy

**Solution:**
1. Check for long-running queries: `npm run supabase:logs`
2. Restart Supabase: `npm run supabase:stop && npm run supabase:start`
3. Check Docker resources (memory/CPU)

### Diff empty but schema changed

**Solution:**
1. Ensure Docker is healthy: `docker ps`
2. Use `--use-migra` flag: `npm run supabase:diff`
3. Check shadow database port (65432) is available
4. Reset shadow DB: `npx supabase db reset --shadow`

### Migration history mismatch

**Solution:**
```bash
# Check status
npx supabase migration list

# Repair if needed
npx supabase migration repair --status applied <timestamp>
```

### Types not updating

**Solution:**
1. Regenerate from local: `npm run supabase:types`
2. Ensure local schema is up to date: `npm run supabase:push`
3. Check output file path in script

### Port already in use

**Solution:**
1. Change ports in `supabase/config.toml`
2. Or stop conflicting service
3. Restart Supabase

### Can't connect to local database

**Solution:**
1. Verify Supabase is running: `npm run supabase:status`
2. Check Docker is running
3. Verify port 65431 is available
4. Check connection string format

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Start | `npm run supabase:start` | Start local Supabase |
| Stop | `npm run supabase:stop` | Stop local Supabase |
| Status | `npm run supabase:status` | Check status and URLs |
| Studio | `npm run supabase:studio` | Open Supabase Studio |
| Push | `npm run supabase:push` | Apply migrations to local |
| Diff | `npm run supabase:diff` | Generate migration from diff |
| Pull | `npm run supabase:pull` | Pull schema from remote |
| Seed | `npm run supabase:seed` | Reset and seed database |
| Reset | `npm run supabase:reset:hard` | Hard reset (requires confirmation) |
| Logs | `npm run supabase:logs` | Follow database logs |
| Types | `npm run supabase:types` | Generate TypeScript types |
| Test RLS | `npm run supabase:test:rls` | Run RLS tests |

## Best Practices

1. ✅ **Local first** - Always test locally before cloud push
2. ✅ **Version lock** - Supabase CLI version locked in package.json
3. ✅ **Migration files** - Commit all migration files to git
4. ✅ **Test RLS** - Validate RLS policies before cloud push
5. ✅ **Generate types** - Keep TypeScript types in sync
6. ✅ **Use --linked** - Always use `--linked` flag for cloud operations
7. ✅ **Environment separation** - Keep local and cloud env vars separate
8. ✅ **Regular backups** - Create snapshots before risky changes
9. ✅ **Descriptive names** - Use clear migration names
10. ✅ **Review SQL** - Double-check migration SQL before applying

## Project-Specific Notes

- **Project Reference**: `opaxtxfxropmjrrqlewh`
- **Custom Ports**: 65430-65437 (configured to avoid conflicts)
- **Migration files**: `supabase/migrations/`
- **Seed file**: `supabase/seed.sql`
- **Types output**: `supabase/types/database.ts`
- **RLS tests**: `tests/rls/run.sql`
- **CLI version**: Locked in `package.json` devDependencies

## Next Steps

1. **Start local development:**
   ```bash
   npm install
   npm run supabase:start
   npm run supabase:push
   ```

2. **Create your first migration:**
   ```bash
   npm run supabase:diff
   npm run supabase:push
   ```

3. **Test RLS policies:**
   ```bash
   npm run supabase:test:rls
   ```

4. **Generate types:**
   ```bash
   npm run supabase:types
   ```

5. **When ready, push to cloud:**
   ```bash
   npx supabase link --project-ref opaxtxfxropmjrrqlewh
   npx supabase db push --linked
   ```

---

For more details: https://supabase.com/docs/guides/cli
