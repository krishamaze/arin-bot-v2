# Supabase Schema Verification Guide

This guide helps you verify that your local database schema is aligned with your remote Supabase database.

## Prerequisites

1. **Docker Desktop** must be running (required for shadow database operations)
2. **.env file** with database connection string

## Setup

### 1. Configure .env file

Create a `.env` file in the project root with your database connection string:

```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[HOST]:[PORT]/postgres
```

**Example:**
```env
DATABASE_URL=postgresql://postgres.abc123xyz:your_password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

**Where to find your connection string:**
- Go to Supabase Dashboard → Your Project → Settings → Database
- Copy the "Connection string" → "URI" format
- Replace `[YOUR-PASSWORD]` with your actual database password

**Connection Types:**
- **Pooler connection** (recommended for CLI): Port `6543`
  - Format: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
- **Direct connection**: Port `5432`
  - Format: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`

### 2. Start Docker Desktop

Make sure Docker Desktop is running before running schema verification commands.

## Verification Methods

### Method 1: Pull Schema from Remote (Recommended first step)

This creates local migration files from your remote database schema:

```powershell
.\verify-schema.ps1 -PullSchema
```

Or manually:
```powershell
$encoded = [System.Web.HttpUtility]::UrlEncode($env:DATABASE_URL)
supabase db pull --db-url $encoded
```

This will create migration files in `supabase/migrations/` directory.

### Method 2: Compare Local Migrations with Remote

After pulling or creating migrations, compare them with remote:

```powershell
.\verify-schema.ps1 -DiffSchema
```

Or manually:
```powershell
$encoded = [System.Web.HttpUtility]::UrlEncode($env:DATABASE_URL)
supabase db diff --db-url $encoded
```

This shows any differences between your local migrations and remote database.

### Method 3: Using Linked Project (Alternative)

If your project is linked to Supabase:

```powershell
# Link project (if not already linked)
supabase link --project-ref [YOUR_PROJECT_REF]

# Pull schema
supabase db pull

# Compare schemas
supabase db diff --linked
```

## Troubleshooting

### Docker Desktop Not Running
- **Error**: `failed to inspect container health` or `Docker Desktop is a prerequisite`
- **Solution**: Start Docker Desktop and wait for it to fully start

### Connection Failed
- **Error**: `failed to connect to postgres` or `Tenant or user not found`
- **Solutions**:
  - Verify your database password is correct
  - Check that your connection string is properly formatted
  - Ensure URL encoding is applied (the script handles this automatically)
  - Try using direct connection (port 5432) instead of pooler (port 6543)

### No Migrations Found
- **Error**: No migrations directory or files
- **Solution**: Run `.\verify-schema.ps1 -PullSchema` first to create migrations from remote

### Shadow Database Errors
- **Error**: Issues with shadow database
- **Solution**: Ensure Docker Desktop is running and has sufficient resources allocated

## Notes

- The `.env` file is gitignored (as it should be) - never commit it
- Database connection strings contain sensitive information - keep them secure
- Both `db pull` and `db diff` require Docker for shadow database operations
- Connection strings must be URL-encoded when passed to CLI commands

