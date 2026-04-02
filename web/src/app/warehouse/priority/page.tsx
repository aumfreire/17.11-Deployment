import { getDb } from "@/lib/db";

export default async function WarehousePriorityPage() {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT
         o.order_id,
         o.order_datetime,
         o.order_total,
         p.late_delivery_probability,
         p.predicted_late_delivery,
         p.prediction_timestamp
       FROM orders o
       INNER JOIN order_predictions p ON p.order_id = o.order_id
       WHERE o.fulfilled = 0
       ORDER BY p.late_delivery_probability DESC
       LIMIT 50`,
    )
    .all() as {
    order_id: number;
    order_datetime: string;
    order_total: number;
    late_delivery_probability: number;
    predicted_late_delivery: number;
    prediction_timestamp: string;
  }[];

  return (
    <div>
      <h1>Warehouse priority</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Open orders (<code>fulfilled = 0</code>) with a row in <code>order_predictions</code>, ranked by
        late-delivery probability (model score, not a guarantee). Place an order, run scoring, then refresh.
      </p>
      {rows.length === 0 ? (
        <p>No rows yet. Use <a href="/scoring">Run scoring</a> after you have unfulfilled orders.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>When</th>
              <th>Total</th>
              <th>Late %</th>
              <th>Pred late</th>
              <th>Scored at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.order_id}>
                <td>#{r.order_id}</td>
                <td>{r.order_datetime}</td>
                <td>${r.order_total.toFixed(2)}</td>
                <td>{(r.late_delivery_probability * 100).toFixed(1)}%</td>
                <td>{r.predicted_late_delivery ? "Yes" : "No"}</td>
                <td>{r.prediction_timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
