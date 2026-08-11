import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 本地开发加载 .env；生产环境使用平台注入的 process.env，文件不存在时静默忽略
dotenv.config({ path: resolve(__dirname, '../.env') });

import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pkg;

// Create a PostgreSQL connection pool
// Neon 在空闲时会挂起计算实例，需要配置连接超时和自动重试
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tradezella',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_HOST?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // 连接超时 10 秒
  idleTimeoutMillis: 30000,        // 空闲连接 30 秒后释放
  max: 10,                          // 最大连接数
});

// 监听连接错误，防止进程崩溃
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
  // 不退出进程，让后续请求重新获取连接
});

// 包装 query 方法，添加自动重试逻辑
const originalQuery = pool.query.bind(pool);
pool.query = async function (...args) {
  const maxRetries = 2;
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await originalQuery(...args);
    } catch (err) {
      lastError = err;
      const isConnectionError =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout');
      if (!isConnectionError || i === maxRetries) {
        throw err;
      }
      console.warn(`DB query failed (attempt ${i + 1}/${maxRetries + 1}): ${err.message}, retrying...`);
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
};

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