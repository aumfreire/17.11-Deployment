-- =============================================================================
-- Run AFTER importing rows from SQLite with explicit primary keys.
-- COALESCE(MAX, 0) + default is_called=true → next auto-generated id is MAX+1 (or 1 if empty).
-- =============================================================================

SELECT setval(
  pg_get_serial_sequence('customers', 'customer_id'),
  COALESCE((SELECT MAX(customer_id) FROM customers), 0)
);
SELECT setval(
  pg_get_serial_sequence('products', 'product_id'),
  COALESCE((SELECT MAX(product_id) FROM products), 0)
);
SELECT setval(
  pg_get_serial_sequence('orders', 'order_id'),
  COALESCE((SELECT MAX(order_id) FROM orders), 0)
);
SELECT setval(
  pg_get_serial_sequence('order_items', 'order_item_id'),
  COALESCE((SELECT MAX(order_item_id) FROM order_items), 0)
);
SELECT setval(
  pg_get_serial_sequence('shipments', 'shipment_id'),
  COALESCE((SELECT MAX(shipment_id) FROM shipments), 0)
);
SELECT setval(
  pg_get_serial_sequence('product_reviews', 'review_id'),
  COALESCE((SELECT MAX(review_id) FROM product_reviews), 0)
);
