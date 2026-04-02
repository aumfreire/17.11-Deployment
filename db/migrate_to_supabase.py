"""
migrate_to_supabase.py — copy db/shop.db → Supabase Postgres (optional; prefer scripts/sqlite_to_postgres.py)

SETUP:
  pip install psycopg2-binary

FROM REPO ROOT:
  export DATABASE_URL='postgresql://...@....pooler.supabase.com:5432/postgres?sslmode=require'
  python3 db/migrate_to_supabase.py

Use the Session or Transaction pooler URI from Supabase (Connect), not Direct, if you get
"No route to host" (IPv6). Encode special characters in the password (+ → %2B).

Never commit passwords — DATABASE_URL only in your shell / .env.local (untracked).

Before running: apply supabase/migrations/20250402120000_shop_schema.sql in the SQL Editor.
"""
from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parent.parent
SQLITE_PATH = ROOT / "db" / "shop.db"

# FK-safe order. Tables missing in SQLite are skipped.
TABLE_ORDER = [
    "customers",
    "products",
    "orders",
    "order_items",
    "shipments",
    "product_reviews",
    "order_predictions",
]

TABLE_COLUMNS = {
    "customers": [
        "customer_id", "full_name", "email", "gender", "birthdate",
        "created_at", "city", "state", "zip_code", "customer_segment",
        "loyalty_tier", "is_active",
    ],
    "products": [
        "product_id", "sku", "product_name", "category", "price",
        "cost", "is_active",
    ],
    "orders": [
        "order_id", "customer_id", "order_datetime", "billing_zip",
        "shipping_zip", "shipping_state", "payment_method", "device_type",
        "ip_country", "promo_used", "promo_code", "order_subtotal",
        "shipping_fee", "tax_amount", "order_total", "risk_score", "is_fraud",
        "fulfilled",
    ],
    "order_items": [
        "order_item_id", "order_id", "product_id", "quantity",
        "unit_price", "line_total",
    ],
    "shipments": [
        "shipment_id", "order_id", "ship_datetime", "carrier",
        "shipping_method", "distance_band", "promised_days",
        "actual_days", "late_delivery",
    ],
    "product_reviews": [
        "review_id", "customer_id", "product_id", "rating",
        "review_datetime", "review_text",
    ],
    "order_predictions": [
        "order_id", "late_delivery_probability", "predicted_late_delivery", "prediction_timestamp",
    ],
}


def _sqlite_has_table(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (name,),
    ).fetchone()
    return row is not None


def _sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cur = conn.execute(f"PRAGMA table_info('{table}')")
    return [r[1] for r in cur.fetchall()]


def migrate_table(sqlite_conn: sqlite3.Connection, pg_conn, table: str) -> int:
    want = TABLE_COLUMNS[table]
    have = set(_sqlite_columns(sqlite_conn, table))
    columns = [c for c in want if c in have]
    if table == "orders" and "fulfilled" not in have:
        # Older shop.db without Chapter-17 migration
        columns = [c for c in columns if c != "fulfilled"]

    col_list = ", ".join(f'"{c}"' for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    rows = sqlite_conn.execute(f"SELECT {col_list} FROM {table}").fetchall()

    if not rows:
        print(f"  ⏭  {table}: empty, skipping")
        return 0

    sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders})'

    with pg_conn.cursor() as cur:
        batch_size = 500
        inserted = 0
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            cur.executemany(sql, batch)
            inserted += len(batch)
            if len(rows) > batch_size:
                pct = min(100, int(inserted / len(rows) * 100))
                print(f"    ... {inserted:,}/{len(rows):,} ({pct}%)")

    pg_conn.commit()
    return len(rows)


def reset_sequence(pg_conn, table: str, pk_col: str) -> None:
    sql = f"""SELECT setval(
        pg_get_serial_sequence('"{table}"', '{pk_col}'),
        COALESCE((SELECT MAX("{pk_col}") FROM "{table}"), 0)
    );"""
    with pg_conn.cursor() as cur:
        try:
            cur.execute(sql)
            pg_conn.commit()
        except Exception:
            pg_conn.rollback()


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL to your Supabase Postgres URI.", file=sys.stderr)
        sys.exit(1)
    if not SQLITE_PATH.exists():
        print(f"Missing SQLite file: {SQLITE_PATH}", file=sys.stderr)
        sys.exit(1)

    print("📂 Opening shop.db...")
    sqlite_conn = sqlite3.connect(str(SQLITE_PATH))

    print("🔌 Connecting to Supabase...")
    pg_conn = psycopg2.connect(url)
    print("   Connected!\n")

    with pg_conn.cursor() as cur:
        cur.execute(
            "TRUNCATE TABLE order_predictions, product_reviews, shipments, "
            "order_items, orders, products, customers RESTART IDENTITY CASCADE"
        )
        pg_conn.commit()
    print("🗑  Truncated shop tables on Postgres (clean reload).\n")

    total = 0
    for table in TABLE_ORDER:
        if not _sqlite_has_table(sqlite_conn, table):
            print(f"📦 {table}\n  ⏭  not in SQLite, skipping\n")
            continue
        print(f"📦 {table}")
        try:
            count = migrate_table(sqlite_conn, pg_conn, table)
            total += count
            print(f"  ✅ {count:,} rows inserted\n")
        except Exception as e:
            pg_conn.rollback()
            print(f"  ❌ FAILED: {e}\n")

    print("🔧 Resetting primary key sequences...")
    pk_map = {
        "customers": "customer_id",
        "products": "product_id",
        "orders": "order_id",
        "order_items": "order_item_id",
        "shipments": "shipment_id",
        "product_reviews": "review_id",
    }
    for table, pk in pk_map.items():
        reset_sequence(pg_conn, table, pk)
    print("   Done.\n")

    print("🔍 Verifying row counts in Supabase:")
    with pg_conn.cursor() as cur:
        for table in TABLE_ORDER:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                count = cur.fetchone()[0]
                print(f"   {table:20s} → {count:,} rows")
            except Exception:
                pass

    sqlite_conn.close()
    pg_conn.close()
    print(f"\n🎉 Done. {total:,} rows copied from SQLite.")


if __name__ == "__main__":
    main()
