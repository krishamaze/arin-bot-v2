# Supabase Usage Patterns

This document outlines the Supabase usage patterns for this codebase.

## Current Implementation

### Edge Functions (Deno)

This codebase uses **Supabase Edge Functions** (Deno), which have different patterns than client-side usage:

```typescript
// Edge Function - Service Role Key (Bypasses RLS)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

### Query Patterns

✅ **Current Usage:**
```typescript
// SELECT queries
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', 'value')
  .order('timestamp', { ascending: false })
  .limit(50);

// Error checking
if (error) {
  console.error('Error:', error);
  return [];
}
return data || [];
```

### Error Handling

✅ **Current Implementation:**
- ✅ Checks errors before using data
- ✅ Handles specific error codes (e.g., `PGRST116` for not found)
- ✅ Returns fallback values (empty array, null) on error
- ✅ Logs errors for debugging

**Example:**
```typescript
const { data, error } = await supabase
  .from('room_summaries')
  .select('*')
  .eq('bot_id', botId)
  .eq('room_id', roomId)
  .single();

if (error && error.code !== 'PGRST116') {
  console.error('Error fetching room summary:', error);
}
return data || null;
```

## Client-Side Patterns (For Reference)

If adding client-side code in the future, use these patterns:

### Import
```typescript
import { supabase } from '../lib/supabase'
```

### Queries
```typescript
// Basic query
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('column', 'value')
  .order('created_at', { ascending: false });

// Always check error before using data
if (error) {
  console.error('Error:', error);
  return;
}
// Use data safely
console.log(data);
```

### RPC Calls
```typescript
const { data, error } = await supabase
  .rpc('function_name', { 
    param1: 'value1',
    param2: 'value2'
  });

if (error) {
  console.error('RPC error:', error);
  return;
}
```

### Auth
```typescript
// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

if (error) {
  console.error('Auth error:', error);
  return;
}
```

## Important Notes

### Row Level Security (RLS)

- **Edge Functions**: Use `SUPABASE_SERVICE_ROLE_KEY` which **bypasses RLS**
- **Client-Side**: Always respects RLS based on current user's session
- **Best Practice**: Edge Functions should validate permissions manually when needed

### Error Handling Rules

1. ✅ **Always check error before using data**
   ```typescript
   const { data, error } = await supabase.from('table').select();
   if (error) {
     // Handle error
     return;
   }
   // Use data safely
   ```

2. ✅ **Handle specific error codes**
   ```typescript
   if (error?.code === 'PGRST116') {
     // Not found - create new record
   }
   ```

3. ✅ **Provide fallback values**
   ```typescript
   return data || [];
   return data || null;
   ```

### Current Codebase Status

✅ **Following Patterns:**
- Using `.from()`, `.select()`, `.eq()`, `.order()` correctly
- Checking errors before using data
- Proper error logging
- Fallback values on error

⚠️ **Areas for Improvement:**
- Some queries don't handle all error cases
- Consider adding retry logic for transient errors
- Add more specific error messages

❌ **Not Applicable (Edge Functions):**
- `supabase.auth.signInWithPassword()` - Not used in Edge Functions
- RPC calls - Not currently used in codebase
- Client-side RLS - Edge Functions use service role key

## Migration Considerations

If migrating to client-side usage:

1. **Change import pattern:**
   ```typescript
   // From: Deno import
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
   
   // To: Client-side import
   import { supabase } from '../lib/supabase';
   ```

2. **Remove service role key:**
   ```typescript
   // Edge Function (current)
   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
   
   // Client-side (future)
   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

3. **RLS will be enforced:**
   - Ensure RLS policies are set up correctly
   - Test queries with different user sessions
   - Handle permission errors appropriately

