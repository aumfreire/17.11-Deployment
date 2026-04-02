import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Props = { params: Promise<{ orderId: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { orderId: raw } = await params;
  const orderId = parseInt(raw, 10);
  if (!Number.isFinite(orderId)) notFound();

  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <div>
        <p>
          <Link href="/select-customer">Select customer</Link>
        </p>
      </div>
    );
  }

  const db = getDb();
  const order = db
    .prepare(
      `SELECT * FROM orders WHERE order_id = ? AND customer_id = ?`,
    )
    .get(orderId, customerId) as Record<string, unknown> | undefined;
  if (!order) notFound();

  const items = db
    .prepare(
      `SELECT oi.*, p.product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.order_item_id`,
    )
    .all(orderId);

  return (
    <div>
      <p>
        <Link href="/orders">← Orders</Link>
      </p>
      <h1>Order #{orderId}</h1>
      <div className="card">
        <p>
          <strong>Placed:</strong> {String(order.order_datetime)}
        </p>
        <p>
          <strong>Total:</strong> ${Number(order.order_total).toFixed(2)} ·{" "}
          {Number(order.fulfilled) ? "Fulfilled" : "Open"}
        </p>
      </div>
      <h2>Line items</h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Line</th>
          </tr>
        </thead>
        <tbody>
          {(items as { sku: string; product_name: string; quantity: number; unit_price: number; line_total: number }[]).map(
            (r, i) => (
              <tr key={i}>
                <td>{r.sku}</td>
                <td>{r.product_name}</td>
                <td>{r.quantity}</td>
                <td>${r.unit_price.toFixed(2)}</td>
                <td>${r.line_total.toFixed(2)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
