"use server";

import { getCustomerId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type OrderLineInput = { product_id: number; quantity: number };

export async function placeOrderAction(input: {
  lines: OrderLineInput[];
  payment_method: string;
  device_type: string;
  ip_country: string;
  promo_code: string;
}): Promise<{ orderId: number } | { error: string }> {
  const customerId = await getCustomerId();
  if (!customerId) {
    return { error: "No customer selected." };
  }

  const lines = input.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) {
    return { error: "Add at least one line with quantity ≥ 1." };
  }

  const db = getDb();
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  try {
  const orderIdResult = db.transaction(() => {
    let subtotal = 0;
    const resolved: { product_id: number; quantity: number; unit_price: number; line_total: number }[] =
      [];

    for (const l of lines) {
      const p = db
        .prepare(`SELECT price FROM products WHERE product_id = ? AND is_active = 1`)
        .get(l.product_id) as { price: number } | undefined;
      if (!p) {
        throw new Error(`Invalid product ${l.product_id}`);
      }
      const unit = p.price;
      const lt = Math.round(unit * l.quantity * 100) / 100;
      subtotal += lt;
      resolved.push({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: unit,
        line_total: lt,
      });
    }

    const shipping_fee = subtotal < 50 ? 5.99 : 0;
    const tax_amount = Math.round(subtotal * 0.0725 * 100) / 100;
    const order_total = Math.round((subtotal + shipping_fee + tax_amount) * 100) / 100;
    const promo_used = input.promo_code.trim() ? 1 : 0;

    const info = db
      .prepare(
        `SELECT zip_code, state FROM customers WHERE customer_id = ?`,
      )
      .get(customerId) as { zip_code: string | null; state: string | null } | undefined;

    const r = db
      .prepare(
        `INSERT INTO orders (
          customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
          payment_method, device_type, ip_country, promo_used, promo_code,
          order_subtotal, shipping_fee, tax_amount, order_total, risk_score, is_fraud, fulfilled
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, 0
        )`,
      )
      .run(
        customerId,
        now,
        info?.zip_code ?? null,
        info?.zip_code ?? null,
        info?.state ?? null,
        input.payment_method,
        input.device_type,
        input.ip_country,
        promo_used,
        input.promo_code.trim() || null,
        subtotal,
        shipping_fee,
        tax_amount,
        order_total,
        12.5,
        0,
      );

    const orderId = Number(r.lastInsertRowid);

    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const row of resolved) {
      insItem.run(orderId, row.product_id, row.quantity, row.unit_price, row.line_total);
    }

    return orderId;
  })();

  return { orderId: orderIdResult };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
