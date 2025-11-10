#!/usr/bin/env node

/**
 * Safety guard script for hard database reset.
 * Requires CONFIRM_RESET=true environment variable to prevent accidental nukes.
 */

const { execSync } = require('child_process');
const readline = require('readline');

const CONFIRM_RESET = process.env.CONFIRM_RESET === 'true';

if (!CONFIRM_RESET) {
  console.error('❌ Safety guard: Hard reset requires CONFIRM_RESET=true');
  console.error('');
  console.error('To perform a hard reset, run:');
  console.error('  CONFIRM_RESET=true npm run supabase:reset:hard');
  console.error('');
  console.error('⚠️  WARNING: This will destroy all local data and reset to migration state.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  Are you sure you want to hard reset the local database? This will delete ALL data. Type "yes" to confirm: ', (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log('Reset cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('🔄 Resetting local database...');
  try {
    execSync('npx supabase db reset', { stdio: 'inherit' });
    console.log('✅ Database reset complete.');
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  }
  
  rl.close();
});

