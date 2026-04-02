import Database from "better-sqlite3";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { getDbPath } from "./paths";

type Row = Record<string, unknown>;

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

type PreparedStatement = {
  get<T extends Row = Row>(...params: unknown[]): Promise<T | undefined>;
  all<T extends Row = Row>(...params: unknown[]): Promise<T[]>;
  run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }>;
};

type AppDb = {
  prepare(sql: string): PreparedStatement;
  transaction<T>(fn: () => Promise<T> | T): () => Promise<T>;
  listTables(): Promise<{ name: string }[]>;
  tableInfo(name: string): Promise<ColumnInfo[]>;
};

let sqliteDb: Database.Database | null = null;
let pgPool: Pool | null = null;
const txClient = new AsyncLocalStorage<PoolClient>();

function isPostgresMode(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getSqliteDb(): Database.Database {
  if (process.env.VERCEL) {
    throw new Error(
      "SQLite is not available on Vercel. Set DATABASE_URL to your Supabase pooler connection string in Vercel environment variables.",
    );
  }
  if (!sqliteDb) {
    sqliteDb = new Database(getDbPath());
    sqliteDb.pragma("foreign_keys = ON");
  }
  return sqliteDb;
}

function getPgPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set.");
    }
    const normalizedUrl = new URL(connectionString);
    normalizedUrl.searchParams.delete("sslmode");
    pgPool = new Pool({
      connectionString: normalizedUrl.toString(),
      ssl: { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function toColumnInfo(rows: Row[]): ColumnInfo[] {
  return rows.map((row) => ({
    cid: Number(row.cid),
    name: String(row.name),
    type: String(row.type ?? ""),
    notnull: Number(row.notnull ?? 0),
    dflt_value: row.dflt_value ?? null,
    pk: Number(row.pk ?? 0),
  }));
}

async function queryPostgres(sql: string, params: unknown[]) {
  const client = txClient.getStore() ?? getPgPool();
  const result = await client.query(convertPlaceholders(sql), params);
  return result.rows as Row[];
}

function preparePostgres(sql: string): PreparedStatement {
  return {
    async get<T extends Row = Row>(...params: unknown[]): Promise<T | undefined> {
      const rows = await queryPostgres(sql, params);
      return (rows[0] as T | undefined) ?? undefined;
    },
    async all<T extends Row = Row>(...params: unknown[]): Promise<T[]> {
      return (await queryPostgres(sql, params)) as T[];
    },
    async run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
      const client = txClient.getStore() ?? getPgPool();
      const result = await client.query(convertPlaceholders(sql), params);
      const firstRow = result.rows[0] as Row | undefined;
      const maybeInsertedId = firstRow ? Number(firstRow.order_id ?? firstRow.id ?? firstRow[Object.keys(firstRow)[0] ?? ""]) : NaN;
      return {
        changes: result.rowCount ?? 0,
        lastInsertRowid: Number.isFinite(maybeInsertedId) ? maybeInsertedId : undefined,
      };
    },
  };
}

function prepareSqlite(sql: string): PreparedStatement {
  const db = getSqliteDb();
  return {
    async get<T extends Row = Row>(...params: unknown[]): Promise<T | undefined> {
      return (db.prepare(sql).get(...params) as T | undefined) ?? undefined;
    },
    async all<T extends Row = Row>(...params: unknown[]): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid?: number }> {
      const result = db.prepare(sql).run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    },
  };
}

function createDb(): AppDb {
  return {
    prepare(sql: string): PreparedStatement {
      return isPostgresMode() ? preparePostgres(sql) : prepareSqlite(sql);
    },
    transaction<T>(fn: () => Promise<T> | T): () => Promise<T> {
      if (!isPostgresMode()) {
        return async () => {
          const db = getSqliteDb();
          db.exec("BEGIN");
          try {
            const result = await fn();
            db.exec("COMMIT");
            return result;
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        };
      }

      return async () => {
        const client = await getPgPool().connect();
        try {
          await client.query("BEGIN");
          const result = await txClient.run(client, async () => fn());
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      };
    },
    async listTables(): Promise<{ name: string }[]> {
      if (!isPostgresMode()) {
        return getSqliteDb()
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
          .all() as { name: string }[];
      }
      const rows = await queryPostgres(
        `SELECT table_name AS name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
           AND table_name NOT LIKE 'pg_%'
           AND table_name NOT LIKE 'sql_%'
         ORDER BY table_name`,
        [],
      );
      return rows as { name: string }[];
    },
    async tableInfo(name: string): Promise<ColumnInfo[]> {
      if (!isPostgresMode()) {
        return getSqliteDb().prepare(`PRAGMA table_info('${name.replace(/'/g, "''")}')`).all() as ColumnInfo[];
      }
      const rows = await queryPostgres(
        `SELECT
           cols.ordinal_position - 1 AS cid,
           cols.column_name AS name,
           cols.data_type AS type,
           CASE WHEN cols.is_nullable = 'NO' THEN 1 ELSE 0 END AS notnull,
           cols.column_default AS dflt_value,
           CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS pk
         FROM information_schema.columns cols
         LEFT JOIN (
           SELECT kcu.column_name
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
            AND tc.table_name = kcu.table_name
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND tc.table_schema = 'public'
             AND tc.table_name = $1
         ) pk ON pk.column_name = cols.column_name
         WHERE cols.table_schema = 'public'
           AND cols.table_name = $1
         ORDER BY cols.ordinal_position`,
        [name],
      );
      return toColumnInfo(rows);
    },
  };
}

let db: AppDb | null = null;

export function getDb(): AppDb {
  if (!db) {
    db = createDb();
  }
  return db;
}
