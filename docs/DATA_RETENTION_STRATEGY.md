# Data Retention Strategy

## Overview

This document outlines the data retention and archiving strategy for the chat bot database, specifically for the `events` table which grows continuously.

## Current State

- **events table**: Stores all chat messages/events
- **Query pattern**: Fetches last 50 messages per bot-room combination
- **Growth rate**: Continuous (every message creates a new row)
- **Impact**: Large tables can slow down queries and increase storage costs

## Retention Strategy

### Option 1: Time-Based Archival (Recommended)

Archive events older than a specified period (e.g., 90 days) to a separate archive table.

**Implementation:**
1. Create `events_archive` table with same schema as `events`
2. Create a scheduled job (Supabase cron or Edge Function) to:
   - Move events older than 90 days to `events_archive`
   - Delete archived events from `events` table
3. Run job weekly or monthly

**Pros:**
- Reduces `events` table size
- Preserves historical data
- Improves query performance
- Reduces storage costs

**Cons:**
- Requires additional table
- Need to query archive table for historical analysis

### Option 2: Deletion After Retention Period

Simply delete events older than retention period.

**Implementation:**
1. Create scheduled job to delete events older than 90 days
2. Use `DELETE FROM events WHERE timestamp < NOW() - INTERVAL '90 days'`

**Pros:**
- Simple implementation
- No additional storage needed

**Cons:**
- Permanent data loss
- No historical analysis possible

### Option 3: Partitioning

Use PostgreSQL table partitioning to automatically manage old data.

**Implementation:**
1. Partition `events` table by timestamp (monthly partitions)
2. Automatically drop old partitions after retention period
3. Requires PostgreSQL 10+ (Supabase supports this)

**Pros:**
- Automatic management
- Excellent query performance
- Easy to drop old data

**Cons:**
- More complex setup
- Requires migration of existing table

## Recommended Implementation: Time-Based Archival

### Step 1: Create Archive Table

```sql
-- Create events_archive table
CREATE TABLE IF NOT EXISTS events_archive (
  LIKE events INCLUDING ALL
);

-- Add archive timestamp
ALTER TABLE events_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NOW();
```

### Step 2: Create Archive Function

```sql
-- Function to archive old events
CREATE OR REPLACE FUNCTION archive_old_events(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(archived_count BIGINT) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Move old events to archive
  INSERT INTO events_archive
  SELECT *, NOW() as archived_at
  FROM events
  WHERE timestamp < cutoff_date;
  
  -- Delete archived events
  DELETE FROM events
  WHERE timestamp < cutoff_date;
  
  -- Return count of archived events
  RETURN QUERY SELECT COUNT(*)::BIGINT FROM events_archive WHERE archived_at > NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;
```

### Step 3: Create Scheduled Job

Using Supabase cron (pg_cron extension):

```sql
-- Schedule weekly archival (runs every Sunday at 2 AM UTC)
SELECT cron.schedule(
  'archive-old-events',
  '0 2 * * 0',  -- Every Sunday at 2 AM
  $$SELECT archive_old_events(90)$$
);
```

Or using Supabase Edge Function with scheduled triggers.

### Step 4: Monitor Archive Size

```sql
-- Check archive table size
SELECT 
  pg_size_pretty(pg_total_relation_size('events_archive')) AS archive_size,
  COUNT(*) AS archived_events
FROM events_archive;

-- Check current events table size
SELECT 
  pg_size_pretty(pg_total_relation_size('events')) AS events_size,
  COUNT(*) AS current_events,
  MIN(timestamp) AS oldest_event,
  MAX(timestamp) AS newest_event
FROM events;
```

## Retention Period Recommendations

- **Active events**: 90 days (configurable)
- **Archive**: Keep indefinitely or set separate retention (e.g., 1 year)
- **Summary tables**: Keep indefinitely (they're small and critical for context)

## Migration Plan

1. **Phase 1**: Create archive table and function (no data movement)
2. **Phase 2**: Test archival on a small subset
3. **Phase 3**: Schedule regular archival job
4. **Phase 4**: Monitor and adjust retention period as needed

## Query Modifications

If historical data is needed, queries can be modified to check archive:

```sql
-- Query recent events from main table
SELECT * FROM events 
WHERE bot_id = $1 AND room_id = $2 
ORDER BY timestamp DESC 
LIMIT 50;

-- Query historical events from archive
SELECT * FROM events_archive 
WHERE bot_id = $1 AND room_id = $2 
  AND timestamp >= $3  -- Start date
  AND timestamp < $4   -- End date
ORDER BY timestamp DESC;
```

## Monitoring

Track these metrics:
- Events table row count
- Events table size
- Archive table size
- Query performance (should improve as table shrinks)
- Archive job execution logs

## Rollback Plan

If issues occur:
1. Stop the cron job
2. Restore from archive if needed: `INSERT INTO events SELECT * FROM events_archive WHERE ...`
3. Adjust retention period or disable archival

