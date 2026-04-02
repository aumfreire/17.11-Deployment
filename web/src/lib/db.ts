import Database from "better-sqlite3";
import { getDbPath } from "./paths";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("foreign_keys = ON");
  }
  return db;
}
