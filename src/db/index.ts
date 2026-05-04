import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var saberxPool: pg.Pool | undefined;
}

const connectionString = process.env.DATABASE_URL ?? "postgres://saberx:saberx@localhost:5432/saberx";

export const pool =
  globalThis.saberxPool ??
  new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.saberxPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
