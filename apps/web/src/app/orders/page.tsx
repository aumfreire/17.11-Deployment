import Link from "next/link";
import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export default async function OrdersPage() {
  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <div>
        <h1>Orders</h1>
        <Link href="/select-customer">Select customer →</Link>
      </div>
    );
  }

  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT order_id, order_datetime, order_total, fulfilled
       FROM orders WHERE customer_id = ?
       ORDER BY order_datetime DESC
       LIMIT 200`,
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
      <h1>Order history</h1>
      <p className="lead">Latest 200 orders for the selected customer.</p>
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
      {rows.length === 0 ? (
        <div className="empty-state">No orders yet for this customer.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>When</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.order_id}>
                <td>
                  <Link href={`/orders/${r.order_id}`} className="table-link">
                    #{r.order_id}
                  </Link>
                </td>
                <td>{r.order_datetime}</td>
                <td>${r.order_total.toFixed(2)}</td>
                <td>{r.fulfilled ? "Fulfilled" : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
