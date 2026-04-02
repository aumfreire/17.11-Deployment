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

  return (
    <div>
      <h1>Order history</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>When</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.order_id}>
              <td>
                <Link href={`/orders/${r.order_id}`}>#{r.order_id}</Link>
              </td>
              <td>{r.order_datetime}</td>
              <td>${r.order_total.toFixed(2)}</td>
              <td>{r.fulfilled ? "Fulfilled" : "Open"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
