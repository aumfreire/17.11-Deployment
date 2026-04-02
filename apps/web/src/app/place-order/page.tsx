import Link from "next/link";
import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PlaceOrderForm } from "./PlaceOrderForm";

export const dynamic = "force-dynamic";

export default async function PlaceOrderPage() {
  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <div>
        <h1>Place order</h1>
        <p>Select a customer first.</p>
        <Link href="/select-customer">Select customer →</Link>
      </div>
    );
  }

  const db = getDb();
  const customer = await db
    .prepare(`SELECT full_name, email FROM customers WHERE customer_id = ?`)
    .get(customerId) as { full_name: string; email: string } | undefined;

  if (!customer) {
    return (
      <div>
        <h1>Place order</h1>
        <p className="err">Customer {customerId} not found.</p>
        <Link href="/select-customer">Select customer →</Link>
      </div>
    );
  }

  const products = await db
    .prepare(
      `SELECT product_id, sku, product_name, price FROM products WHERE is_active = 1 ORDER BY product_name LIMIT 500`,
    )
    .all();

  return (
    <div>
      <h1>Place order</h1>
      <p className="lead">Creates one order and all line items in a single database transaction.</p>
      <div className="card">
        <p>
          <strong>Customer:</strong> {customer.full_name}
          <span className="muted"> · {customer.email}</span>
        </p>
        <Link href="/select-customer">Change customer →</Link>
      </div>
      {products.length === 0 ? (
        <p>No active products.</p>
      ) : (
        <PlaceOrderForm products={products as never} />
      )}
    </div>
  );
}
