import { getDb } from "@/lib/db";
import { CustomerSelectClient } from "./CustomerSelectClient";

export const dynamic = "force-dynamic";

export default async function SelectCustomerPage() {
  const db = getDb();
  const customers = await db
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
      <p className="lead">
        Choose the customer context for this session. This sets the <code>customer_id</code> cookie used by
        dashboard, orders, and place-order flows.
      </p>
      <CustomerSelectClient customers={customers as never} />
    </div>
  );
}
