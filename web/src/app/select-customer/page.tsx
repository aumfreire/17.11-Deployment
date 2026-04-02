import { getDb } from "@/lib/db";
import { CustomerSelectClient } from "./CustomerSelectClient";

export default function SelectCustomerPage() {
  const db = getDb();
  const customers = db
    .prepare(
      `SELECT customer_id, full_name, email, city, state
       FROM customers
       WHERE is_active = 1
       ORDER BY full_name
       LIMIT 500`,
    )
    .all();

  return (
    <div>
      <h1>Select customer</h1>
      <p style={{ color: "var(--muted)" }}>
        Sets a <code>customer_id</code> cookie used by dashboard, orders, and place order.
      </p>
      <CustomerSelectClient customers={customers as never} />
    </div>
  );
}
