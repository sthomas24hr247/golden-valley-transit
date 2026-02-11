/**
 * Azure SQL Database Connection
 */

import sql from 'mssql';
import { logger } from '../utils/logger';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER || 'orchestrate-sql-8e43bd5f.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'orchestrate_ai',
  user: process.env.AZURE_SQL_USER || 'sqladmin',
  password: process.env.AZURE_SQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connecting) return connecting;
  connecting = createPool();
  try {
    pool = await connecting;
    return pool;
  } finally {
    connecting = null;
  }
}

async function createPool(): Promise<sql.ConnectionPool> {
  logger.info('Connecting to Azure SQL...', { server: config.server, database: config.database });
  const newPool = new sql.ConnectionPool(config);
  newPool.on('error', (err) => { logger.error('Azure SQL pool error', { error: err.message }); pool = null; });
  await newPool.connect();
  logger.info('✅ Connected to Azure SQL', { server: config.server, database: config.database });
  return newPool;
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.close(); pool = null; logger.info('Azure SQL connection closed'); }
}

export async function isConnected(): Promise<boolean> {
  try {
    const p = await getPool();
    const result = await p.request().query('SELECT 1 as connected');
    return result.recordset[0]?.connected === 1;
  } catch { return false; }
}

export { sql };
export default getPool;
