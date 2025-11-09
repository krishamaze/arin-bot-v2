# Utility Scripts

This directory contains utility scripts for database management, testing, and development tasks.

## 📋 Available Scripts

### PowerShell Scripts

#### `test-connection.ps1`

Tests the connection to your Supabase PostgreSQL database.

**Usage:**
```powershell
.\scripts\test-connection.ps1
```

**What it does:**
- Reads database credentials from `.env` file
- Attempts to connect to PostgreSQL
- Displays connection status and basic database info
- Useful for verifying your database configuration

**Requirements:**
- PostgreSQL client tools installed
- Valid `DATABASE_URL` in `.env` file

---

#### `verify-schema.ps1`

Verifies and optionally pulls the database schema.

**Usage:**
```powershell
# Just verify the schema
.\scripts\verify-schema.ps1

# Pull schema to migration file
.\scripts\verify-schema.ps1 -PullSchema
```

**Parameters:**
- `-PullSchema`: Creates a migration file with current database schema

**What it does:**
- Connects to the database
- Retrieves current schema information
- Optionally creates a migration file in `supabase/migrations/`
- Useful for syncing local schema with remote database

---

#### `list-tables.ps1`

Lists all tables in the database with basic information.

**Usage:**
```powershell
.\scripts\list-tables.ps1
```

**What it does:**
- Connects to the database
- Lists all tables in the public schema
- Shows table names and row counts
- Useful for quick database overview

---

#### `list-tables-sql.ps1`

Lists tables using direct SQL queries with more detailed information.

**Usage:**
```powershell
.\scripts\list-tables-sql.ps1
```

**What it does:**
- Executes SQL queries from `sql_queries/` directory
- Shows detailed table information including sizes
- Displays column information
- More comprehensive than `list-tables.ps1`

---

### SQL Query Templates

Located in `sql_queries/` directory. These are reusable SQL queries for common database operations.

#### `01_list_tables.sql`

Basic query to list all tables in the public schema.

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

---

#### `02_tables_with_sizes.sql`

Lists tables with their disk sizes.

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

#### `03_detailed_table_info.sql`

Provides detailed information about each table including row counts and sizes.

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

#### `04_tables_with_columns.sql`

Lists all tables with their column definitions.

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

---

## 🔧 Common Workflows

### Initial Database Setup

```powershell
# 1. Test connection
.\scripts\test-connection.ps1

# 2. Verify schema
.\scripts\verify-schema.ps1

# 3. List tables to confirm
.\scripts\list-tables.ps1
```

### Schema Synchronization

```powershell
# Pull current schema from remote database
.\scripts\verify-schema.ps1 -PullSchema

# This creates a migration file in supabase/migrations/
# Review the migration file before applying
```

### Database Inspection

```powershell
# Quick overview
.\scripts\list-tables.ps1

# Detailed information with sizes
.\scripts\list-tables-sql.ps1
```

### Troubleshooting Connection Issues

```powershell
# Test basic connectivity
.\scripts\test-connection.ps1

# If connection fails:
# 1. Check .env file for correct DATABASE_URL
# 2. Verify network connectivity
# 3. Check Supabase dashboard for database status
# 4. Ensure you're using the Session Pooler connection string
```

## 📝 Creating Custom Scripts

### PowerShell Script Template

```powershell
# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

$DATABASE_URL = [Environment]::GetEnvironmentVariable('DATABASE_URL')

# Your script logic here
Write-Host "Running custom script..."

# Execute SQL query
psql $DATABASE_URL -c "SELECT * FROM your_table;"
```

### SQL Query Template

```sql
-- Description: What this query does
-- Usage: How to use this query
-- Author: Your name
-- Date: YYYY-MM-DD

SELECT 
  column1,
  column2,
  COUNT(*) as count
FROM your_table
WHERE condition = true
GROUP BY column1, column2
ORDER BY count DESC;
```

## 🛠️ Prerequisites

### Required Tools

- **PowerShell** (Windows) or **PowerShell Core** (cross-platform)
- **PostgreSQL Client Tools** (`psql` command)
  - Windows: Install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
  - macOS: `brew install postgresql`
  - Linux: `sudo apt-get install postgresql-client`

### Environment Setup

Ensure your `.env` file contains:

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**Important**: Use the **Session Pooler** connection string (port 5432), not the direct connection (port 6543).

## 🔍 Troubleshooting

### Common Issues

#### "psql: command not found"

**Solution**: Install PostgreSQL client tools (see Prerequisites above)

#### "Connection refused"

**Possible causes:**
- Incorrect `DATABASE_URL` in `.env`
- Database is not running
- Firewall blocking connection
- Using wrong port (use 5432 for Session Pooler)

**Solution**: 
1. Verify `DATABASE_URL` in Supabase Dashboard
2. Check database status in Supabase Dashboard
3. Ensure you're using Session Pooler connection string

#### "Authentication failed"

**Possible causes:**
- Incorrect password in `DATABASE_URL`
- Password contains special characters not properly encoded

**Solution**:
1. Get fresh connection string from Supabase Dashboard
2. URL-encode special characters in password
3. Verify project reference is correct

#### "Permission denied"

**Possible causes:**
- Using anon key instead of service role key
- Insufficient database permissions

**Solution**:
1. Ensure you're using the correct credentials
2. Check user permissions in Supabase Dashboard

## 📚 Additional Resources

- [Supabase CLI Guide](../docs/SUPABASE_CLI_GUIDE.md)
- [Database Tables Reference](../docs/DATABASE_TABLES.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)

## 🤝 Contributing

To add new scripts:

1. Create your script in the `scripts/` directory
2. Add documentation to this README
3. Test thoroughly
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2025-11-08

