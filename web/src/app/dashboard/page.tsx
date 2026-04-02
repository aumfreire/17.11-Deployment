import Link from "next/link";
import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function DashboardPage() {
  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p>No customer selected.</p>
        <Link href="/select-customer">Choose a customer →</Link>
      </div>
    );
  }

  const db = getDb();
  const customer = await db
    .prepare(`SELECT full_name, email, customer_segment, loyalty_tier FROM customers WHERE customer_id = ?`)
    .get(customerId) as
    | { full_name: string; email: string; customer_segment: string | null; loyalty_tier: string | null }
    | undefined;

  if (!customer) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p className="err">Customer {customerId} not found.</p>
        <Link href="/select-customer">Select another →</Link>
      </div>
    );
  }

  const orders = await db
    .prepare(
      `SELECT order_id, order_datetime, order_total, fulfilled
       FROM orders
       WHERE customer_id = ?
       ORDER BY order_datetime DESC
       LIMIT 5`,
    )
    .all(customerId) as {
    order_id: number;
    order_datetime: string;
    order_total: number;
    fulfilled: number;
  }[];

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>{customer.full_name}</strong>
          <span style={{ color: "var(--muted)" }}> · {customer.email}</span>
        </p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          {[customer.customer_segment, customer.loyalty_tier].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <h2>Recent orders</h2>
      {orders.length === 0 ? (
        <p>No orders yet. <Link href="/place-order">Place one →</Link></p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>When</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id}>
                <td>
                  <Link href={`/orders/${o.order_id}`}>#{o.order_id}</Link>
                </td>
                <td>{o.order_datetime}</td>
                <td>${o.order_total.toFixed(2)}</td>
                <td>{o.fulfilled ? "Fulfilled" : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
