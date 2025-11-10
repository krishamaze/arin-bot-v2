# Wingman Schema Documentation

*Last updated: 2025-11-09*

Complete database schema for the Wingman Dating Chat Helper.

## Tables

### 1. `users`

Unified table for both bot owners and matches (girls).

**Columns:**
- `id` (UUID, PRIMARY KEY) - Default: `gen_random_uuid()`
- `platform_id` (TEXT, UNIQUE, NOT NULL) - Platform-specific user ID
- `user_type` (TEXT, NOT NULL) - `'bot_owner'` or `'match'`
- `display_name` (TEXT, NOT NULL) - User's display name
- `profile_data` (JSONB) - Default: `'{}'::jsonb` - User profile information
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_users_platform_id` - Columns: `platform_id` (UNIQUE)
- `idx_users_type` - Columns: `user_type`
- `idx_users_profile_data_gin` - GIN index on `profile_data` (JSONB)
- `idx_users_age` - Expression index on `(profile_data->>'age')` WHERE `user_type = 'match'`
- `idx_users_interests` - GIN index on `(profile_data->'interests')` WHERE `user_type = 'match'`

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `platform_id`
- CHECK: `user_type IN ('bot_owner', 'match')`

**Example:**
```sql
INSERT INTO users (platform_id, user_type, display_name, profile_data)
VALUES (
  'user-123',
  'bot_owner',
  'John Doe',
  '{"age": 28, "interests": ["tech", "movies"]}'::jsonb
);
```

---

### 2. `conversations`

Stores 1-on-1 conversations between bot owner and match.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Default: `gen_random_uuid()`
- `bot_user_id` (UUID, NOT NULL) - Foreign key to `users.id` (bot owner)
- `match_user_id` (UUID, NULLABLE) - Foreign key to `users.id` (match/girl)
- `room_path` (TEXT, NOT NULL) - Room path identifier
- `conversation_status` (TEXT) - Default: `'pending'` - Status: `'pending'`, `'active'`, `'paused'`, `'archived'`
- `metadata` (JSONB) - Default: `'{}'::jsonb` - Additional conversation metadata
- `created_at` (TIMESTAMPTZ) - Default: `now()`
- `updated_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_conversations_bot_match` - Columns: `bot_user_id`, `match_user_id`
- `idx_conversations_metadata_gin` - GIN index on `metadata` (JSONB)
- `idx_conversations_bot_match_active` (UNIQUE, PARTIAL) - Columns: `bot_user_id`, `match_user_id` WHERE `match_user_id IS NOT NULL`

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: (`bot_user_id`, `room_path`)
- FOREIGN KEY: `bot_user_id` → `users.id` ON DELETE CASCADE
- FOREIGN KEY: `match_user_id` → `users.id` ON DELETE CASCADE
- CHECK: `conversation_status IN ('pending', 'active', 'paused', 'archived')`

**Important Notes:**
- `match_user_id` is **nullable** to allow initialization before the first girl message
- Conversation starts as `'pending'` and becomes `'active'` when match is identified
- Partial unique index ensures only one active conversation per bot-match pair

**Example:**
```sql
-- Initial conversation (pending, no match yet)
INSERT INTO conversations (bot_user_id, room_path, conversation_status)
VALUES (
  'user-uuid',
  '/room/123',
  'pending'
);

-- Update when match is identified
UPDATE conversations
SET match_user_id = 'girl-uuid',
    conversation_status = 'active',
    updated_at = now()
WHERE id = 'conversation-uuid';
```

---

### 3. `messages`

Stores individual messages in conversations.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Default: `gen_random_uuid()`
- `conversation_id` (UUID, NOT NULL) - Foreign key to `conversations.id`
- `sender_id` (UUID, NOT NULL) - Foreign key to `users.id`
- `message_text` (TEXT, NOT NULL) - Message content
- `message_type` (TEXT) - Default: `'user'` - Type: `'user'`, `'bot_suggestion'`, `'sent'`
- `sentiment` (TEXT, NULLABLE) - Sentiment: `'positive'`, `'neutral'`, `'flirty'`, `'serious'`, `'confused'`
- `timestamp` (BIGINT, NOT NULL) - Message timestamp (Unix milliseconds)
- `created_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_messages_conversation_time` - Columns: `conversation_id`, `timestamp DESC`
- `idx_messages_sender` - Columns: `sender_id`
- `idx_messages_sentiment` (PARTIAL) - Columns: `conversation_id`, `sentiment` WHERE `sentiment IS NOT NULL`

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `conversation_id` → `conversations.id` ON DELETE CASCADE
- FOREIGN KEY: `sender_id` → `users.id` ON DELETE CASCADE
- CHECK: `message_type IN ('user', 'bot_suggestion', 'sent')`
- CHECK: `sentiment IN ('positive', 'neutral', 'flirty', 'serious', 'confused')` OR `sentiment IS NULL`

**Example:**
```sql
INSERT INTO messages (conversation_id, sender_id, message_text, timestamp)
VALUES (
  'conversation-uuid',
  'user-uuid',
  'Hey! How are you?',
  EXTRACT(EPOCH FROM now()) * 1000
);
```

---

### 4. `bot_suggestions`

Stores Wingman analysis and suggestions for conversations.

**Columns:**
- `id` (UUID, PRIMARY KEY) - Default: `gen_random_uuid()`
- `conversation_id` (UUID, NOT NULL) - Foreign key to `conversations.id`
- `prompt_context` (JSONB, NOT NULL) - Context used for generation
- `analysis` (JSONB, NULLABLE) - Analysis result
- `suggestions` (JSONB, NOT NULL) - Array of suggestions
- `wingman_tip` (TEXT, NULLABLE) - Coaching tip
- `user_selected_index` (INTEGER, NULLABLE) - Which suggestion user selected
- `model_used` (TEXT) - Default: `'gemini-2.5-flash'` - Model name
- `response_time_ms` (INTEGER, NULLABLE) - Response time in milliseconds
- `cached_tokens` (INTEGER, NULLABLE) - Number of cached tokens used
- `created_at` (TIMESTAMPTZ) - Default: `now()`

**Indexes:**
- `idx_bot_suggestions_conversation` - Columns: `conversation_id`, `created_at DESC`

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `conversation_id` → `conversations.id` ON DELETE CASCADE

**Example:**
```sql
INSERT INTO bot_suggestions (
  conversation_id,
  prompt_context,
  analysis,
  suggestions,
  wingman_tip,
  response_time_ms,
  cached_tokens
)
VALUES (
  'conversation-uuid',
  '{"user_profile": {...}, "girl_profile": {...}}'::jsonb,
  '{"her_last_message_feeling": "curious", ...}'::jsonb,
  '[{"type": "Playful/Humorous", "text": "...", ...}]'::jsonb,
  'Try to ask open-ended questions',
  1234,
  500
);
```

## JSONB Indexing Strategy

### GIN Indexes
- **`profile_data`**: Full-text search and containment queries
- **`interests`**: Array containment queries (e.g., `profile_data->'interests' ? 'tech'`)
- **`metadata`**: Flexible metadata queries

### B-tree Expression Indexes
- **`age`**: Direct age filtering (`profile_data->>'age'`)
- **Partial indexes**: Only index rows where `user_type = 'match'`

### Query Examples

```sql
-- Find matches by age range (uses idx_users_age)
SELECT * FROM users
WHERE user_type = 'match'
  AND (profile_data->>'age')::int BETWEEN 25 AND 35;

-- Find matches by interests (uses idx_users_interests)
SELECT * FROM users
WHERE user_type = 'match'
  AND profile_data->'interests' @> '["tech"]'::jsonb;

-- Search profile data (uses idx_users_profile_data_gin)
SELECT * FROM users
WHERE profile_data @> '{"location": "NYC"}'::jsonb;
```

## Relationships

```
users (bot_owner)
  └─> conversations (bot_user_id)
        ├─> messages (conversation_id)
        └─> bot_suggestions (conversation_id)

users (match)
  └─> conversations (match_user_id)
        └─> messages (sender_id)
```

## Migration Notes

### Nullable `match_user_id`
- Allows initialization before first girl message
- Updated when first message from girl arrives
- Partial unique index ensures data integrity for active conversations

### Status Flow
1. **pending**: Conversation created, no match yet
2. **active**: Match identified, conversation active
3. **paused**: Conversation temporarily paused
4. **archived**: Conversation archived

### Caching Strategy
- System prompt + user/girl profiles cached per user-girl pair
- Cache TTL: 1 hour (3600 seconds)
- Cache key format: `wingman_v2_{userId}_{girlId}`
- Fallback to non-cached if cache creation fails

## Performance Considerations

1. **JSONB Indexes**: Enable fast queries on profile data
2. **Partial Indexes**: Reduce index size by filtering rows
3. **Composite Indexes**: Optimize common query patterns
4. **Cascading Deletes**: Automatic cleanup of related records

## Security Considerations

1. **Foreign Keys**: Enforce referential integrity
2. **Check Constraints**: Validate enum values
3. **Unique Constraints**: Prevent duplicate conversations
4. **Cascade Deletes**: Clean up orphaned records

