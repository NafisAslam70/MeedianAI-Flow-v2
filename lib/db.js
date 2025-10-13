import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis;

const pool =
  globalForDb.__meedianFlowPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const db = globalForDb.__meedianFlowDb ?? drizzle(pool);

if (!globalForDb.__meedianFlowPool) {
  globalForDb.__meedianFlowPool = pool;
}

if (!globalForDb.__meedianFlowDb) {
  globalForDb.__meedianFlowDb = db;
}

export { db, pool };
