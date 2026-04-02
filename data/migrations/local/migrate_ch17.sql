-- Chapter 17 alignment (reference). Prefer idempotent:
--   python3 db/migrate_ch17.py

-- fulfilled: 0 = open; 1 = has shipment row (historical)
ALTER TABLE orders ADD COLUMN fulfilled INTEGER NOT NULL DEFAULT 0;

UPDATE orders
SET fulfilled = 1
WHERE order_id IN (SELECT order_id FROM shipments);

CREATE TABLE IF NOT EXISTS order_predictions (
  order_id                      INTEGER PRIMARY KEY,
  late_delivery_probability     REAL NOT NULL,
  predicted_late_delivery       INTEGER NOT NULL,
  prediction_timestamp          TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
