import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForFinanceDb = globalThis;

const financeConnectionString = process.env.FINANCE_DATABASE_URL;

let financePool;
let financeDb;

if (financeConnectionString) {
  financePool =
    globalForFinanceDb.__meedianFinancePool ??
    new Pool({
      connectionString: financeConnectionString,
    });

  financeDb = globalForFinanceDb.__meedianFinanceDb ?? drizzle(financePool);

  if (!globalForFinanceDb.__meedianFinancePool) {
    globalForFinanceDb.__meedianFinancePool = financePool;
  }

  if (!globalForFinanceDb.__meedianFinanceDb) {
    globalForFinanceDb.__meedianFinanceDb = financeDb;
  }
}

export { financeConnectionString, financeDb, financePool };
