import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  const totalScored = rows.length;
  const predictedLateCount = rows.filter((r) => r.predicted_late_delivery).length;
  const predictedOnTimeCount = totalScored - predictedLateCount;
  const highRiskCount = rows.filter((r) => r.late_delivery_probability >= 0.6).length;
  const avgLateProbability =
    totalScored === 0
      ? 0
      : rows.reduce((sum, r) => sum + r.late_delivery_probability, 0) / totalScored;

  return (
    <div>
      <h1>Warehouse priority</h1>
      <p className="lead">
        Open orders (<code>fulfilled = 0</code>) with a row in <code>order_predictions</code>, ranked by
        late-delivery probability (model score, not a guarantee). Place an order, run scoring, then refresh.
      </p>
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Scored open orders</span>
          <span className="stat-value">{totalScored}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Predicted late</span>
          <span className="stat-value">{predictedLateCount}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Predicted on-time</span>
          <span className="stat-value">{predictedOnTimeCount}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">High risk (&gt;=60%)</span>
          <span className="stat-value">{highRiskCount}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Avg late probability</span>
          <span className="stat-value">{(avgLateProbability * 100).toFixed(1)}%</span>
        </article>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">No rows yet. Use <a href="/scoring">Run scoring</a> after you have unfulfilled orders.</div>
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
                <td>
                  <span className={`status-bubble ${r.predicted_late_delivery ? "status-yes" : "status-no"}`}>
                    {r.predicted_late_delivery ? "Yes" : "No"}
                  </span>
                </td>
                <td>{r.prediction_timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
