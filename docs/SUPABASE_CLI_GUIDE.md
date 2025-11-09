# Supabase CLI Guide — Migrations & Database Checks

This guide is tailored for the **arin-bot-v2** project.

## Current Project Status

- **Supabase CLI**: ✅ Installed in virtual environment (v2.54.11)
- **Virtual Environment**: ✅ `.venv_supabase` directory
- **Project Link**: ❌ Not linked (needs linking)
- **Migrations Directory**: ✅ Created (`supabase/migrations/`)
- **Migration Files**: ❌ None yet (need to pull from remote)
- **TypeScript Types**: ❌ Not generated yet

## Installation

This project uses a **node-based virtual environment** for Supabase CLI to avoid global installs and version conflicts.

### Setup Virtual Environment (First Time)

```bash
# Create virtual environment directory
mkdir .venv_supabase
cd .venv_supabase

# Initialize npm
npm init -y

# Install Supabase CLI as dev dependency
npm install supabase --save-dev
```

### Verify Installation

```bash
# From project root
npx --prefix .venv_supabase supabase --version
# Output: 2.54.11
```

**Benefits:**
- ✅ No global install required
- ✅ Version pinned in `package.json`
- ✅ No cross-project conflicts
- ✅ Each repo has its own CLI version

---

## Initial Setup

### 1. Login to Supabase

```bash
npx --prefix .venv_supabase supabase login
```

Opens browser for authentication.

### 2. Link Your Project

**Your project reference**: `opaxtxfxropmjrrqlewh`

```bash
# List your projects
npx --prefix .venv_supabase supabase projects list

# Link to your project
npx --prefix .venv_supabase supabase link --project-ref opaxtxfxropmjrrqlewh
```

**Verify link:**

```bash
npx --prefix .venv_supabase supabase status
```

**Note**: After linking, you can use `--linked` flag for remote operations instead of `--db-url`.

---

## Migration Workflow

### Pull Existing Schema from Remote

Since your database already exists, first pull the current schema:

```bash
# Option 1: Using linked project (after linking)
npx --prefix .venv_supabase supabase db pull

# Option 2: Using direct connection (current method)
# Make sure DATABASE_URL is in .env and password is correct
.\scripts\verify-schema.ps1 -PullSchema
```

This creates migration files in `supabase/migrations/` based on your remote database.

### Create a New Migration

```bash
# Creates timestamped file in supabase/migrations/
npx --prefix .venv_supabase supabase migration new <migration-name>

# Example:
npx --prefix .venv_supabase supabase migration new add_user_profiles

# Creates: supabase/migrations/20250115120000_add_user_profiles.sql
```

### Edit Migration File

Edit the generated SQL file in `supabase/migrations/`:

```sql
-- Example migration
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);
```

### Apply Migrations to Remote

```bash
# Push all pending migrations to remote database
npx --prefix .venv_supabase supabase db push

# Or explicitly use linked project
npx --prefix .venv_supabase supabase db push --linked
```

### Check Migration Status

```bash
# List all migrations and their status
npx --prefix .venv_supabase supabase migration list

# Shows:
# - Applied migrations (✓)
# - Pending migrations (pending)
# - Local-only migrations (local)
```

### Repair Migration History

If migration history gets out of sync:

```bash
# Mark a migration as applied (if it was applied manually)
npx --prefix .venv_supabase supabase migration repair --status applied <migration-timestamp>

# Example:
npx --prefix .venv_supabase supabase migration repair --status applied 20250115120000
```

---

## Database Inspection

### Check Table Statistics

```bash
# View table sizes, row counts, and disk usage
npx --prefix .venv_supabase supabase inspect db table-stats --linked
```

### Database Statistics

```bash
# Overall database stats
npx --prefix .venv_supabase supabase inspect db db-stats --linked
```

### Index Statistics

```bash
# Check index usage and performance
npx --prefix .venv_supabase supabase inspect db index-stats --linked
```

### Query Performance

```bash
# Long-running queries
npx --prefix .venv_supabase supabase inspect db long-running-queries --linked

# Blocking queries
npx --prefix .venv_supabase supabase inspect db blocking --linked

# Performance outliers
npx --prefix .venv_supabase supabase inspect db outliers --linked
```

---

## TypeScript Types Generation

After schema changes, regenerate types:

```bash
# Generate types from remote database
npx --prefix .venv_supabase supabase gen types typescript --linked > src/types/database.ts

# Or save to custom location (for Edge Functions)
npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
```

**Note**: For Edge Functions (Deno), you may want to save types to:
- `supabase/types/database.ts` (recommended for this project)
- Or import directly in Edge Functions

---

## Common Workflows

### Initial Setup (First Time)

```bash
# 1. Login
npx --prefix .venv_supabase supabase login

# 2. Link project
npx --prefix .venv_supabase supabase link --project-ref opaxtxfxropmjrrqlewh

# 3. Pull existing schema
npx --prefix .venv_supabase supabase db pull

# 4. Generate types
npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
```

### Daily Development

```bash
# 1. Create migration
npx --prefix .venv_supabase supabase migration new add_feature

# 2. Edit migration file
# ... write SQL ...

# 3. Push to remote
npx --prefix .venv_supabase supabase db push

# 4. Regenerate types
npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
```

### Before Deployment

```bash
# 1. Check migration status
npx --prefix .venv_supabase supabase migration list

# 2. Push any pending migrations
npx --prefix .venv_supabase supabase db push

# 3. Verify database health
npx --prefix .venv_supabase supabase inspect db table-stats --linked

# 4. Update types
npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
```

### Debugging Issues

```bash
# Check for blocking queries
npx --prefix .venv_supabase supabase inspect db blocking --linked

# Find slow queries
npx --prefix .venv_supabase supabase inspect db outliers --linked

# View table stats
npx --prefix .venv_supabase supabase inspect db table-stats --linked
```

---

## Local Development (Optional - Requires Docker)

If you want to test migrations locally:

```bash
# Start local Supabase
npx --prefix .venv_supabase supabase start

# Reset local database (applies all migrations)
npx --prefix .venv_supabase supabase db reset

# Stop local Supabase
npx --prefix .venv_supabase supabase stop
```

**Note**: Your project uses custom ports (65430-65437) to avoid conflicts with other Supabase projects.

---

## Troubleshooting

### "Project not linked"

```bash
npx --prefix .venv_supabase supabase link --project-ref opaxtxfxropmjrrqlewh
```

### "Migration history mismatch"

```bash
# Check status
npx --prefix .venv_supabase supabase migration list

# Repair if needed
npx --prefix .venv_supabase supabase migration repair --status applied <timestamp>
```

### "Types not updating"

```bash
# Regenerate from remote
npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
```

### "Permission denied"

- Ensure you're logged in: `npx --prefix .venv_supabase supabase login`
- Verify project access in Supabase Dashboard
- Check project-ref is correct: `opaxtxfxropmjrrqlewh`

### "Password authentication failed"

- Verify `DATABASE_URL` in `.env` file
- Check password matches Supabase Dashboard
- Use `.\test-connection.ps1` to diagnose connection issues

---

## Quick Reference

| Task | Command |
|------|---------|
| Link project | `npx --prefix .venv_supabase supabase link --project-ref opaxtxfxropmjrrqlewh` |
| Create migration | `npx --prefix .venv_supabase supabase migration new <name>` |
| Pull schema | `npx --prefix .venv_supabase supabase db pull` |
| Push migrations | `npx --prefix .venv_supabase supabase db push` |
| List migrations | `npx --prefix .venv_supabase supabase migration list` |
| Generate types | `npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts` |
| Check table stats | `npx --prefix .venv_supabase supabase inspect db table-stats --linked` |
| Check slow queries | `npx --prefix .venv_supabase supabase inspect db outliers --linked` |
| Repair migration | `npx --prefix .venv_supabase supabase migration repair --status applied <timestamp>` |
| Test connection | `.\scripts\test-connection.ps1` |
| Verify schema | `.\scripts\verify-schema.ps1 -PullSchema` |

---

## Best Practices

1. ✅ **Link project first** - Use `--linked` flag instead of `--db-url` for convenience
2. ✅ **Pull existing schema** - Before creating new migrations, pull current schema
3. ✅ **Generate types after changes** - Keep TypeScript types in sync
4. ✅ **Use descriptive migration names**: `add_user_profiles`, `update_products_table`
5. ✅ **Commit migration files to git** - Track schema changes in version control
6. ✅ **Review migration SQL before pushing** - Double-check SQL before applying
7. ✅ **Check migration status before deployment** - Ensure all migrations are applied
8. ✅ **Monitor database stats regularly** - Use `inspect db` commands

---

## Project-Specific Notes

- **Project Reference**: `opaxtxfxropmjrrqlewh`
- **Virtual Environment**: `.venv_supabase/` (local CLI installation)
- **Migration files**: `supabase/migrations/`
- **Types output**: `supabase/types/database.ts` (recommended location)
- **Custom ports**: 65430-65437 (configured to avoid conflicts)
- **Connection**: Use session pooler (port 5432) as shown in dashboard
- **Always use `--linked` flag** for remote operations after linking
- **CLI commands**: Use `npx --prefix .venv_supabase supabase` for all commands

---

## Next Steps

1. **Link the project:**
   ```bash
   npx --prefix .venv_supabase supabase link --project-ref opaxtxfxropmjrrqlewh
   ```

2. **Pull existing schema:**
   ```bash
   npx --prefix .venv_supabase supabase db pull
   ```

3. **Generate TypeScript types:**
   ```bash
   npx --prefix .venv_supabase supabase gen types typescript --linked > supabase/types/database.ts
   ```

4. **Verify setup:**
   ```bash
   npx --prefix .venv_supabase supabase migration list
   npx --prefix .venv_supabase supabase status
   ```

---

For more details: https://supabase.com/docs/guides/cli

