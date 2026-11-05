import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required to run migrations.');
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`ERROR: Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  console.log(`Connecting to database...`);
  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log(`Connected successfully. Reading schema from: ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`Executing SCM Flow PostgreSQL schema (${(sql.length / 1024).toFixed(1)} KB)...`);
    await client.query(sql);

    console.log('✅ SCM Flow PostgreSQL schema successfully applied!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

