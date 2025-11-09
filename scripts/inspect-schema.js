// Node.js script to inspect Supabase database schema
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (match) {
    dbUrl = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

if (!dbUrl) {
  console.error('Error: DATABASE_URL not found');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function inspectSchema() {
  try {
    await client.connect();
    console.log('Connected to database\n');
    console.log('=== DATABASE SCHEMA INSPECTION ===\n');

    // 1. List all tables
    console.log('1. TABLES:');
    console.log('─'.repeat(60));
    const tablesResult = await client.query(`
      SELECT tablename, tableowner, schemaname
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    tablesResult.rows.forEach(row => {
      console.log(`  ${row.tablename}`);
    });
    console.log('');

    // 2. Table sizes
    console.log('2. TABLE SIZES:');
    console.log('─'.repeat(60));
    const sizesResult = await client.query(`
      SELECT 
        t.tablename,
        pg_size_pretty(pg_total_relation_size('public.'||t.tablename)) AS total_size,
        pg_size_pretty(pg_relation_size('public.'||t.tablename)) AS table_size,
        pg_size_pretty(pg_indexes_size('public.'||t.tablename)) AS indexes_size
      FROM pg_tables t
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||t.tablename) DESC;
    `);
    console.log('Table Name'.padEnd(40) + 'Total Size'.padEnd(15) + 'Table Size'.padEnd(15) + 'Indexes Size');
    console.log('─'.repeat(85));
    sizesResult.rows.forEach(row => {
      console.log(
        row.tablename.padEnd(40) + 
        row.total_size.padEnd(15) + 
        row.table_size.padEnd(15) + 
        row.indexes_size
      );
    });
    console.log('');

    // 3. Indexes
    console.log('3. INDEXES:');
    console.log('─'.repeat(60));
    const indexesResult = await client.query(`
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
    indexesResult.rows.forEach(row => {
      if (currentTable !== row.tablename) {
        currentTable = row.tablename;
        console.log(`\n  ${row.tablename}:`);
      }
      console.log(`    - ${row.indexname}`);
      console.log(`      ${row.indexdef}`);
    });
    console.log('');

    // 4. Constraints
    console.log('4. CONSTRAINTS:');
    console.log('─'.repeat(60));
    const constraintsResult = await client.query(`
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
    constraintsResult.rows.forEach(row => {
      if (currentTable !== row.table_name) {
        currentTable = row.table_name;
        console.log(`\n  ${row.table_name}:`);
      }
      const fkInfo = row.foreign_table_name 
        ? ` -> ${row.foreign_table_name}(${row.foreign_column_name})`
        : '';
      console.log(`    ${row.constraint_type}: ${row.constraint_name} (${row.column_name})${fkInfo}`);
    });
    console.log('');

    // 5. Column details for key tables
    console.log('5. COLUMN DETAILS (Key Tables):');
    console.log('─'.repeat(60));
    const keyTables = ['bots', 'rooms', 'events', 'room_summaries', 'user_room_summaries', 
                       'user_and_bot_room_summaries', 'user_and_bot_global_summaries'];

    for (const tableName of keyTables) {
      const columnsResult = await client.query(`
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
        columnsResult.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`    - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
        });
      }
    }

    console.log('\n=== INSPECTION COMPLETE ===');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

inspectSchema();

