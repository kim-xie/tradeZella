import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envResult = dotenv.config({ path: resolve(__dirname, '../.env') });
console.log('=== DB Config ===');
console.log('.env error:', envResult.error);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('=================');

import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pkg;

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradezella',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_HOST?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

// Function to get a database connection
export async function getDb() {
  return pool;
}

// Function to run migration files
export async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Get all migration files and sort them
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    // Run each migration file
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`Successfully ran migration: ${file}`);
      } catch (err) {
        console.error(`Error running migration ${file}:`, err);
        throw err;
      }
    }
    
    console.log('All migrations completed successfully');
  } finally {
    client.release();
  }
}

// Function to initialize the database with required tables
export async function initDb() {
  const client = await pool.connect();
  
  try {
    // Run all migrations
    await runMigrations();
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Export the pool for direct queries when needed
export { pool };