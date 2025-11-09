# Database Optimization Summary

## Overview

This document summarizes the database optimizations implemented to improve query performance and reduce storage costs.

## Optimizations Implemented

### 1. Index Optimization

#### Bots Table
- **Index on `platform_id`**: Speeds up bot lookups by platform ID
- **Index on `username`**: Speeds up username lookups and unique constraint checks
- **Unique constraint on `username`**: Ensures data integrity and enables efficient upserts

#### Rooms Table
- **Index on `room_id`**: Speeds up room lookups
- **Unique constraint on `room_id`**: Ensures data integrity

#### Events Table
- **Composite index on `(bot_id, room_id, timestamp DESC)`**: Optimizes the main query pattern for fetching last 50 messages
- **Index on `bot_id`**: Speeds up bot-specific queries
- **Index on `room_id`**: Speeds up room-specific queries
- **Index on `timestamp DESC`**: Speeds up time-based queries
- **Foreign key constraints**: Ensures referential integrity with `bots` and `rooms` tables

#### Summary Tables
- **room_summaries**: Composite index on `(bot_id, room_id)`
- **user_room_summaries**: Composite index on `(bot_id, room_id, user_platform_id)`
- **user_and_bot_room_summaries**: Composite index on `(bot_id, room_id, user_platform_id)`
- **user_and_bot_global_summaries**: Composite index on `(bot_id, user_platform_id)`
- **Unique constraints**: Added to prevent duplicate summaries

### 2. Query Optimization

#### Replaced SELECT * with Specific Columns
- **room_summaries**: Now selects only `summary, mood` instead of all columns
- **user_room_summaries**: Now selects only `user_platform_id, user_display_name, summary`
- **user_and_bot_room_summaries**: Now selects only `user_platform_id, user_display_name, relationship_summary, closeness_score`
- **user_and_bot_global_summaries**: Now selects only `user_platform_id, user_display_name, global_summary`

**Benefits:**
- Reduced data transfer
- Faster query execution
- Lower memory usage
- Better cache efficiency

### 3. Performance Optimization

#### Parallel Execution
- **saveEvents**: Now runs in parallel with LLM API call instead of sequentially
- Events are saved asynchronously while waiting for LLM response
- Reduces total request latency

### 4. Data Integrity

#### Added Constraints
- **NOT NULL constraints**: Added to critical columns (platform_id, username, bot_id, room_id, timestamp, message_text)
- **Foreign key constraints**: Added between events and bots/rooms tables
- **Unique constraints**: Added to prevent duplicate data in summary tables

### 5. Data Retention Strategy

See [DATA_RETENTION_STRATEGY.md](./DATA_RETENTION_STRATEGY.md) for details on:
- Time-based archival approach
- Archive table creation
- Scheduled archival jobs
- Retention period recommendations

## Migration File

The optimization migration is located at:
- `supabase/migrations/20250120000000_add_indexes_and_constraints.sql`

## Expected Performance Improvements

### Query Performance
- **Bot lookups**: 10-100x faster with index on `platform_id`
- **Room lookups**: 10-100x faster with index on `room_id`
- **Event queries**: 50-500x faster with composite index on `(bot_id, room_id, timestamp DESC)`
- **Summary queries**: 10-50x faster with composite indexes

### Storage
- **Query data transfer**: Reduced by 30-70% by selecting specific columns
- **Index storage**: Minimal overhead (~5-10% of table size) for significant performance gains

### Latency
- **Request latency**: Reduced by ~50-200ms by parallelizing event saving with LLM calls

## Deployment Steps

1. **Review the migration file**: Check `supabase/migrations/20250120000000_add_indexes_and_constraints.sql`
2. **Test locally**: Run migration on local database first
3. **Deploy to remote**: Apply migration to production database
4. **Monitor performance**: Check query performance after deployment
5. **Verify indexes**: Run inspection queries to confirm indexes were created

## Monitoring

### Check Index Usage
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Check Table Sizes
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size('public.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

### Check Query Performance
Monitor slow queries using Supabase Dashboard → Database → Query Performance

## Rollback Plan

If issues occur:
1. **Remove indexes**: Drop indexes that cause issues
2. **Remove constraints**: Drop constraints if they block necessary operations
3. **Revert code changes**: Restore previous version of `index.ts` if needed

## Future Optimizations

1. **Table partitioning**: Partition `events` table by timestamp for better performance
2. **Materialized views**: Create materialized views for frequently accessed summary data
3. **Query result caching**: Implement caching for frequently accessed summaries
4. **Connection pooling**: Optimize connection pool settings
5. **Vacuum and analyze**: Schedule regular VACUUM and ANALYZE operations

