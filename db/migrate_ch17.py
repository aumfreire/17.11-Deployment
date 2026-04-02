#!/usr/bin/env python3
"""Idempotent Chapter 17 schema updates for shop.db."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "db" / "shop.db"


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cols = {r[1] for r in cur.execute("PRAGMA table_info(orders)").fetchall()}
    if "fulfilled" not in cols:
        cur.execute(
            "ALTER TABLE orders ADD COLUMN fulfilled INTEGER NOT NULL DEFAULT 0"
        )
        print("Added orders.fulfilled")
    else:
        print("orders.fulfilled already present")

    cur.execute(
        "UPDATE orders SET fulfilled = 1 WHERE order_id IN (SELECT order_id FROM shipments)"
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS order_predictions (
          order_id                      INTEGER PRIMARY KEY,
          late_delivery_probability     REAL NOT NULL,
          predicted_late_delivery       INTEGER NOT NULL,
          prediction_timestamp          TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
        """
    )
    print("order_predictions table ready")

    conn.commit()
    conn.close()
    print("Migration OK:", DB)


if __name__ == "__main__":
    main()
