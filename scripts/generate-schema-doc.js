// Script to generate SUPABASE_TABLE_STRUCTURE.md from actual database schema
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      break;
    }
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

async function generateSchemaDoc() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    const tables = tablesResult.rows.map(r => r.tablename);

    // Get columns for all tables
    const columnsResult = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position;
    `, [tables]);

    // Get indexes
    const indexesResult = await client.query(`
      SELECT
        t.tablename,
        i.indexname,
        i.indexdef
      FROM pg_indexes i
      JOIN pg_tables t ON i.tablename = t.tablename AND i.schemaname = t.schemaname
      WHERE i.schemaname = 'public'
        AND t.tablename = ANY($1)
      ORDER BY t.tablename, i.indexname;
    `, [tables]);

    // Get constraints
    const constraintsResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      LEFT JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `, [tables]);

    // Organize data
    const tableData = {};
    
    // Organize columns
    columnsResult.rows.forEach(col => {
      if (!tableData[col.table_name]) {
        tableData[col.table_name] = {
          columns: [],
          indexes: [],
          constraints: {
            primaryKey: null,
            foreignKeys: [],
            unique: [],
            notNull: []
          }
        };
      }
      
      let dataType = col.data_type;
      if (col.udt_name === 'uuid') dataType = 'UUID';
      else if (col.udt_name === 'text') dataType = 'TEXT';
      else if (col.udt_name === 'jsonb') dataType = 'JSONB';
      else if (col.udt_name === 'timestamptz') dataType = 'TIMESTAMPTZ';
      else if (col.udt_name === 'int4') dataType = 'INTEGER';
      else if (col.udt_name === 'int8') dataType = 'BIGINT';
      else if (col.udt_name === 'numeric') {
        if (col.numeric_scale > 0) {
          dataType = `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
        } else {
          dataType = `NUMERIC(${col.numeric_precision})`;
        }
      } else if (col.character_maximum_length) {
        dataType = `${dataType.toUpperCase()}(${col.character_maximum_length})`;
      } else {
        dataType = dataType.toUpperCase();
      }
      
      tableData[col.table_name].columns.push({
        name: col.column_name,
        type: dataType,
        nullable: col.is_nullable === 'YES',
        default: col.column_default
      });
      
      if (col.is_nullable === 'NO') {
        tableData[col.table_name].constraints.notNull.push(col.column_name);
      }
    });

    // Organize indexes
    indexesResult.rows.forEach(idx => {
      tableData[idx.tablename].indexes.push({
        name: idx.indexname,
        definition: idx.indexdef
      });
    });

    // Organize constraints
    constraintsResult.rows.forEach(constraint => {
      const table = tableData[constraint.table_name];
      if (constraint.constraint_type === 'PRIMARY KEY') {
        table.constraints.primaryKey = constraint.column_name;
      } else if (constraint.constraint_type === 'FOREIGN KEY') {
        table.constraints.foreignKeys.push({
          column: constraint.column_name,
          name: constraint.constraint_name,
          referencesTable: constraint.foreign_table_name,
          referencesColumn: constraint.foreign_column_name,
          onDelete: constraint.delete_rule,
          onUpdate: constraint.update_rule
        });
      } else if (constraint.constraint_type === 'UNIQUE') {
        if (!table.constraints.unique.find(u => u.name === constraint.constraint_name)) {
          table.constraints.unique.push({
            name: constraint.constraint_name,
            columns: [constraint.column_name]
          });
        } else {
          const unique = table.constraints.unique.find(u => u.name === constraint.constraint_name);
          if (!unique.columns.includes(constraint.column_name)) {
            unique.columns.push(constraint.column_name);
          }
        }
      }
    });

    // Get table descriptions from codebase usage
    const tableDescriptions = {
      'analytics': 'Stores analytics and performance metrics for bot interactions.',
      'bot_configs': 'Stores bot configuration per room.',
      'bots': 'Stores bot information and personalities.',
      'embeddings': 'Stores vector embeddings for semantic search and retrieval.',
      'events': 'Stores chat events/messages.',
      'feature_flags': 'Stores feature flags and configuration for bots.',
      'response_threads': 'Stores response thread information for bot conversations.',
      'rooms': 'Stores room/chat room information.',
      'room_summaries': 'Stores room-level conversation summaries.',
      'user_room_summaries': 'Stores user-specific summaries for a room.',
      'user_and_bot_room_summaries': 'Stores summaries combining user and bot interactions in a room.',
      'user_and_bot_global_summaries': 'Stores global summaries of user and bot interactions across all rooms.'
    };

    // Generate markdown
    let md = '# Supabase Table Structure\n\n';
    md += `*Generated from cloud database schema on ${new Date().toISOString().split('T')[0]}*\n\n`;
    md += 'Current database schema for arin-bot-v2 project.\n\n';
    md += '## Tables\n\n';

    tables.forEach((tableName, index) => {
      const data = tableData[tableName];
      md += `### ${index + 1}. \`${tableName}\`\n\n`;
      md += `${tableDescriptions[tableName] || 'Table description not available.'}\n\n`;
      
      md += '**Columns:**\n';
      data.columns.forEach(col => {
        let colDef = `- \`${col.name}\` (${col.type}`;
        if (!col.nullable) colDef += ', NOT NULL';
        if (data.constraints.primaryKey === col.name) colDef += ', PRIMARY KEY';
        colDef += ')';
        if (col.default) {
          colDef += ` - Default: \`${col.default}\``;
        }
        md += colDef + '\n';
      });
      md += '\n';

      if (data.indexes.length > 0) {
        md += '**Indexes:**\n';
        data.indexes.forEach(idx => {
          // Skip primary key indexes as they're already shown in constraints
          if (idx.name.endsWith('_pkey')) return;
          
          // Extract columns from index definition
          const colsMatch = idx.definition.match(/ON [^(]+\(([^)]+)\)/i);
          const columns = colsMatch ? colsMatch[1] : 'unknown';
          
          // Check if it's unique
          const isUnique = idx.definition.toLowerCase().includes('create unique');
          
          md += `- \`${idx.name}\`${isUnique ? ' (UNIQUE)' : ''} - Columns: ${columns}\n`;
        });
        md += '\n';
      }

      if (data.constraints.foreignKeys.length > 0 || data.constraints.unique.length > 0) {
        md += '**Constraints:**\n';
        if (data.constraints.primaryKey) {
          md += `- PRIMARY KEY: \`${data.constraints.primaryKey}\`\n`;
        }
        data.constraints.unique.forEach(uniq => {
          if (uniq.columns.length === 1 && data.constraints.primaryKey !== uniq.columns[0]) {
            md += `- UNIQUE: \`${uniq.columns[0]}\` (\`${uniq.name}\`)\n`;
          } else if (uniq.columns.length > 1) {
            md += `- UNIQUE: (\`${uniq.columns.join('`, `')}\`) (\`${uniq.name}\`)\n`;
          }
        });
        data.constraints.foreignKeys.forEach(fk => {
          md += `- FOREIGN KEY: \`${fk.column}\` → \`${fk.referencesTable}.${fk.referencesColumn}\``;
          if (fk.onDelete) md += ` ON DELETE ${fk.onDelete}`;
          if (fk.onUpdate) md += ` ON UPDATE ${fk.onUpdate}`;
          md += ` (\`${fk.name}\`)\n`;
        });
        md += '\n';
      }

      md += '---\n\n';
    });

    // Add relationships section
    md += '## Relationships\n\n';
    md += '```\n';
    const relationships = [];
    tables.forEach(table => {
      const data = tableData[table];
      data.constraints.foreignKeys.forEach(fk => {
        relationships.push(`${fk.referencesTable} (1) ──< (many) ${table}`);
      });
    });
    md += [...new Set(relationships)].join('\n');
    md += '\n```\n\n';

    // Add index summary - get actual indexes from database
    md += '## Index Summary\n\n';
    md += '### Performance-Critical Indexes\n\n';
    
    // Group indexes by table and identify key performance indexes
    // Only include non-primary-key, non-unique-constraint indexes that are performance-critical
    const keyIndexes = [];
    const skipIndexes = new Set(); // Track indexes to skip (primary keys, unique constraints)
    
    // Add primary key and unique constraint indexes to skip set
    constraintsResult.rows.forEach(constraint => {
      if (constraint.constraint_type === 'PRIMARY KEY' || constraint.constraint_type === 'UNIQUE') {
        // Find the index name for this constraint
        indexesResult.rows.forEach(idx => {
          if (idx.tablename === constraint.table_name && 
              (idx.indexname === constraint.constraint_name || idx.indexname.includes(constraint.constraint_name))) {
            skipIndexes.add(idx.indexname);
          }
        });
      }
    });
    
    indexesResult.rows.forEach(idx => {
      // Skip primary keys, unique constraints, and indexes ending with _key or _pkey
      if (skipIndexes.has(idx.indexname) || 
          idx.indexname.endsWith('_pkey') || 
          idx.indexname.endsWith('_key') ||
          idx.indexname.endsWith('_unique')) {
        return;
      }
      
      const indexName = idx.indexname.toLowerCase();
      const tableName = idx.tablename.toLowerCase();
      
      // Only include performance-critical indexes
      if ((indexName.includes('bot') && indexName.includes('room')) ||
          (indexName.includes('platform_id') && tableName === 'bots') ||
          (indexName.includes('room_id') && tableName === 'rooms') ||
          (indexName.includes('timestamp') && tableName === 'events') ||
          (indexName.includes('lookup') && (tableName.includes('summary') || tableName.includes('embedding')))) {
        let desc = '';
        if (indexName.includes('timestamp')) {
          desc = 'Optimizes timestamp-based queries';
        } else if (indexName.includes('platform_id')) {
          desc = 'Fast bot lookup by platform ID';
        } else if (indexName.includes('room_id')) {
          desc = 'Fast room lookup by room ID';
        } else if (indexName.includes('bot') && indexName.includes('room')) {
          desc = `Composite index for ${idx.tablename} queries by bot and room`;
        } else if (indexName.includes('lookup')) {
          desc = `Lookup index for ${idx.tablename}`;
        } else {
          desc = `Performance index for ${idx.tablename}`;
        }
        keyIndexes.push({ name: idx.indexname, table: idx.tablename, desc });
      }
    });
    
    // Remove duplicates
    const uniqueIndexes = [];
    const seen = new Set();
    keyIndexes.forEach(idx => {
      if (!seen.has(idx.name)) {
        seen.add(idx.name);
        uniqueIndexes.push(idx);
      }
    });
    
    if (uniqueIndexes.length > 0) {
      uniqueIndexes.forEach((idx, i) => {
        md += `${i + 1}. **\`${idx.name}\`** (${idx.table}) - ${idx.desc}\n`;
      });
    } else {
      md += '*Key indexes are listed in each table section above.*\n';
    }
    md += '\n';

    // Add data types reference
    md += '## Data Types Reference\n\n';
    md += '- **UUID** - Universally Unique Identifier (primary keys, foreign keys)\n';
    md += '- **TEXT** - Variable-length text strings\n';
    md += '- **JSONB** - Binary JSON data (indexed, queryable)\n';
    md += '- **TIMESTAMPTZ** - Timestamp with timezone\n';
    md += '- **TIMESTAMP** - Timestamp without timezone\n';
    md += '- **BIGINT** - 64-bit integer\n';
    md += '- **INTEGER** - 32-bit integer\n';
    md += '- **NUMERIC** - Arbitrary precision numeric\n';
    md += '- **BOOLEAN** - True/false values\n';
    md += '- **USER-DEFINED** - Custom types (e.g., vector embeddings)\n';
    md += '\n';

    // Add notes section
    md += '## Notes\n\n';
    md += '- All tables have `created_at` and/or `updated_at` timestamps (auto-managed by Supabase)\n';
    md += '- Foreign keys use `ON DELETE CASCADE` to maintain referential integrity\n';
    md += '- Summary tables (`room_summaries`, `user_room_summaries`, etc.) are READ-ONLY from the application perspective (managed by external processes)\n';
    md += '- The `events` table is the main data table storing all chat messages\n';
    md += '- The `timestamp` column in `events` table uses BIGINT (Unix timestamp in milliseconds)\n';
    md += '- Vector embeddings are stored in the `embeddings` table for semantic search capabilities\n';
    md += '\n';

    // Add schema verification queries
    md += '## Schema Verification Queries\n\n';
    md += 'To verify the current schema, run these queries in Supabase SQL Editor:\n\n';
    md += '```sql\n';
    md += '-- List all tables\n';
    md += "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\n\n";
    md += '-- Get all columns for a specific table\n';
    md += 'SELECT \n';
    md += '  column_name,\n';
    md += '  data_type,\n';
    md += '  is_nullable,\n';
    md += '  column_default\n';
    md += "FROM information_schema.columns\n";
    md += "WHERE table_schema = 'public' \n";
    md += "  AND table_name = 'events'\n";
    md += 'ORDER BY ordinal_position;\n\n';
    md += '-- Get all indexes\n';
    md += 'SELECT tablename, indexname, indexdef\n';
    md += 'FROM pg_indexes\n';
    md += "WHERE schemaname = 'public'\n";
    md += 'ORDER BY tablename, indexname;\n\n';
    md += '-- Get all constraints\n';
    md += 'SELECT\n';
    md += '  tc.table_name,\n';
    md += '  tc.constraint_name,\n';
    md += '  tc.constraint_type,\n';
    md += '  kcu.column_name\n';
    md += 'FROM information_schema.table_constraints AS tc\n';
    md += 'JOIN information_schema.key_column_usage AS kcu\n';
    md += '  ON tc.constraint_name = kcu.constraint_name\n';
    md += "WHERE tc.table_schema = 'public'\n";
    md += 'ORDER BY tc.table_name, tc.constraint_type;\n';
    md += '```\n';

    // Write to file
    const outputPath = path.join(__dirname, '..', 'SUPABASE_TABLE_STRUCTURE.md');
    fs.writeFileSync(outputPath, md, 'utf8');
    console.log(`✅ Schema documentation generated: ${outputPath}`);
    console.log(`   Tables documented: ${tables.length}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

generateSchemaDoc();

