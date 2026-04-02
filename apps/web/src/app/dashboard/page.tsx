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

  const summary = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN fulfilled = 1 THEN 1 ELSE 0 END) AS fulfilled_orders,
         SUM(CASE WHEN fulfilled = 0 THEN 1 ELSE 0 END) AS open_orders,
         COALESCE(SUM(order_total), 0) AS total_spent,
         COALESCE(AVG(order_total), 0) AS avg_order_value,
         MAX(order_datetime) AS last_order_at
       FROM orders
       WHERE customer_id = ?`,
    )
    .get(customerId) as {
      total_orders: number;
      fulfilled_orders: number | null;
      open_orders: number | null;
      total_spent: number;
      avg_order_value: number;
      last_order_at: string | null;
    };

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          <strong>{customer.full_name}</strong>
          <span className="muted"> · {customer.email}</span>
        </p>
        <p className="muted">
          {[customer.customer_segment, customer.loyalty_tier].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Total orders</span>
          <span className="stat-value">{summary.total_orders}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Open</span>
          <span className="stat-value">{summary.open_orders ?? 0}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Fulfilled</span>
          <span className="stat-value">{summary.fulfilled_orders ?? 0}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Total spent</span>
          <span className="stat-value">${summary.total_spent.toFixed(2)}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Avg order value</span>
          <span className="stat-value">${summary.avg_order_value.toFixed(2)}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Last order</span>
          <span className="stat-value stat-value--compact">{summary.last_order_at ?? "No orders"}</span>
        </article>
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
                  <Link href={`/orders/${o.order_id}`} className="table-link">
                    #{o.order_id}
                  </Link>
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
