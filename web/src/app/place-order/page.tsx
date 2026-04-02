import Link from "next/link";
import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PlaceOrderForm } from "./PlaceOrderForm";

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
  const products = await db
    .prepare(
      `SELECT product_id, sku, product_name, price FROM products WHERE is_active = 1 ORDER BY product_name LIMIT 500`,
    )
    .all();

  return (
    <div>
      <h1>Place order</h1>
      <p style={{ color: "var(--muted)" }}>Creates one order + line items in a single database transaction.</p>
      {products.length === 0 ? (
        <p>No active products.</p>
      ) : (
        <PlaceOrderForm products={products as never} />
      )}
    </div>
  );
}
