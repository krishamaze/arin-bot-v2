// Deno script to inspect Supabase database schema
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const dbUrl = Deno.env.get('DATABASE_URL');
if (!dbUrl) {
  console.error('Error: DATABASE_URL not found in environment');
  Deno.exit(1);
}

const client = new Client(dbUrl);
await client.connect();

console.log('=== DATABASE SCHEMA INSPECTION ===\n');

// 1. List all tables
console.log('1. TABLES:');
console.log('─'.repeat(60));
const tablesResult = await client.queryObject<{
  tablename: string;
  tableowner: string;
  schemaname: string;
}>(`
  SELECT tablename, tableowner, schemaname
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY tablename;
`);

for (const row of tablesResult.rows) {
  console.log(`  ${row.tablename}`);
}
console.log('');

// 2. Table sizes
console.log('2. TABLE SIZES:');
console.log('─'.repeat(60));
const sizesResult = await client.queryObject<{
  tablename: string;
  total_size: string;
  table_size: string;
  indexes_size: string;
  row_count: string;
}>(`
  SELECT 
    t.tablename,
    pg_size_pretty(pg_total_relation_size('public.'||t.tablename)) AS total_size,
    pg_size_pretty(pg_relation_size('public.'||t.tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size('public.'||t.tablename)) AS indexes_size,
    (SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.tablename) AS row_count
  FROM pg_tables t
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size('public.'||t.tablename) DESC;
`);

console.log('Table Name'.padEnd(40) + 'Total Size'.padEnd(15) + 'Table Size'.padEnd(15) + 'Indexes Size');
console.log('─'.repeat(85));
for (const row of sizesResult.rows) {
  console.log(
    row.tablename.padEnd(40) + 
    row.total_size.padEnd(15) + 
    row.table_size.padEnd(15) + 
    row.indexes_size
  );
}
console.log('');

// 3. Indexes
console.log('3. INDEXES:');
console.log('─'.repeat(60));
const indexesResult = await client.queryObject<{
  tablename: string;
  indexname: string;
  indexdef: string;
}>(`
  SELECT
    t.tablename,
    i.indexname,
    i.indexdef
  FROM pg_indexes i
  JOIN pg_tables t ON i.tablename = t.tablename AND i.schemaname = t.schemaname
  WHERE i.schemaname = 'public'
  ORDER BY t.tablename, i.indexname;
`);

let currentTable = '';
for (const row of indexesResult.rows) {
  if (currentTable !== row.tablename) {
    currentTable = row.tablename;
    console.log(`\n  ${row.tablename}:`);
  }
  console.log(`    - ${row.indexname}`);
  console.log(`      ${row.indexdef}`);
}
console.log('');

// 4. Constraints
console.log('4. CONSTRAINTS:');
console.log('─'.repeat(60));
const constraintsResult = await client.queryObject<{
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  column_name: string;
  foreign_table_name: string | null;
  foreign_column_name: string | null;
}>(`
  SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
  ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
`);

currentTable = '';
for (const row of constraintsResult.rows) {
  if (currentTable !== row.table_name) {
    currentTable = row.table_name;
    console.log(`\n  ${row.table_name}:`);
  }
  const fkInfo = row.foreign_table_name 
    ? ` -> ${row.foreign_table_name}(${row.foreign_column_name})`
    : '';
  console.log(`    ${row.constraint_type}: ${row.constraint_name} (${row.column_name})${fkInfo}`);
}
console.log('');

// 5. Column details for key tables
console.log('5. COLUMN DETAILS (Key Tables):');
console.log('─'.repeat(60));
const keyTables = ['bots', 'rooms', 'events', 'room_summaries', 'user_room_summaries', 
                   'user_and_bot_room_summaries', 'user_and_bot_global_summaries'];

for (const tableName of keyTables) {
  const columnsResult = await client.queryObject<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);

  if (columnsResult.rows.length > 0) {
    console.log(`\n  ${tableName}:`);
    for (const col of columnsResult.rows) {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`    - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    }
  }
}

await client.end();
console.log('\n=== INSPECTION COMPLETE ===');

