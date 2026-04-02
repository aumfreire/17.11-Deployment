#!/usr/bin/env python3
"""
Copy data from local SQLite shop.db into PostgreSQL (Supabase).

Prerequisites:
  pip install psycopg[binary]
  export DATABASE_URL="postgresql://...@....pooler.supabase.com:6543/postgres?sslmode=require"

  Use Session or Transaction pooler URI from Supabase Connect (not Direct) if you get
  "No route to host" — Direct often resolves to IPv6. Encode + in password as %2B.

Usage (from repo root):
    python3 tools/scripts/sqlite_to_postgres.py

Runs TRUNCATE ... CASCADE on all shop tables (in dependency-safe order), then INSERTs
from SQLite. Run the SQL migration in Supabase first (infra/supabase/migrations/20250402120000_shop_schema.sql).

Optional: then run reset_sequences migration in Supabase SQL editor, or this script calls setval at the end.
"""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQLITE_PATH = ROOT / "data" / "sqlite" / "shop.db"

TABLES_INSERT_ORDER = [
    "customers",
    "products",
    "orders",
    "order_items",
    "shipments",
    "product_reviews",
    "order_predictions",
]

SEQUENCE_COLUMNS = [
    ("customers", "customer_id"),
    ("products", "product_id"),
    ("orders", "order_id"),
    ("order_items", "order_item_id"),
    ("shipments", "shipment_id"),
    ("product_reviews", "review_id"),
]


def _sqlite_table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return row is not None


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL to your Supabase connection string.", file=sys.stderr)
        sys.exit(1)
    if not SQLITE_PATH.exists():
        print(f"Missing SQLite file: {SQLITE_PATH}", file=sys.stderr)
        sys.exit(1)

    try:
        import psycopg
    except ImportError:
        print("Install: pip install 'psycopg[binary]'", file=sys.stderr)
        sys.exit(1)

    sl = sqlite3.connect(SQLITE_PATH)
    sl.row_factory = sqlite3.Row
    pg = psycopg.connect(url, autocommit=False)
    try:
        cur_pg = pg.cursor()
        # Clear existing rows (import order will repopulate)
        cur_pg.execute(
            "TRUNCATE TABLE order_predictions, product_reviews, shipments, order_items, orders, products, customers RESTART IDENTITY CASCADE"
        )

        for table in TABLES_INSERT_ORDER:
            if not _sqlite_table_exists(sl, table):
                print(f"Skip {table} (not in SQLite)")
                continue
            rows = sl.execute(f"SELECT * FROM {table}").fetchall()
            if not rows:
                continue
            cols = rows[0].keys()
            col_list = ", ".join(f'"{c}"' for c in cols)
            placeholders = ", ".join(["%s"] * len(cols))
            insert_sql = f'INSERT INTO {table} ({col_list}) VALUES ({placeholders})'
            for row in rows:
                cur_pg.execute(insert_sql, tuple(row[c] for c in cols))
            print(f"Copied {len(rows)} rows → {table}")

        for table, col in SEQUENCE_COLUMNS:
            # table/col are fixed whitelist above (not user input)
            cur_pg.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), "
                f"COALESCE((SELECT MAX({col}) FROM {table}), 0))"
            )

        pg.commit()
        print("Done. Sequences synced.")
    except Exception:
        pg.rollback()
        raise
    finally:
        pg.close()
        sl.close()


if __name__ == "__main__":
    main()
