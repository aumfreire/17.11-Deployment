"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { placeOrderAction, type OrderLineInput } from "./actions";

type Product = {
  product_id: number;
  sku: string;
  product_name: string;
  price: number;
};

export function PlaceOrderForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<OrderLineInput[]>([{ product_id: products[0]?.product_id ?? 0, quantity: 1 }]);
  const [payment_method] = useState("card");
  const [device_type] = useState("desktop");
  const [ip_country] = useState("US");
  const [promo_code, setPromo] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const res = await placeOrderAction({
      lines,
      payment_method,
      device_type,
      ip_country,
      promo_code,
    });
    setPending(false);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    router.push(`/orders/${res.orderId}`);
  }

  return (
    <form onSubmit={submit} className="card form-card">
      <h2 className="form-section-title">Order lines</h2>
      <div className="order-lines">
        {lines.map((line, i) => (
          <div key={i} className="line-row">
            <div className="field field-product">
              <label>Product</label>
              <select
                value={line.product_id}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...next[i], product_id: parseInt(e.target.value, 10) };
                  setLines(next);
                }}
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.sku} — {p.product_name} (${p.price.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-qty">
              <label>Quantity</label>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...next[i], quantity: Math.max(1, parseInt(e.target.value, 10) || 1) };
                  setLines(next);
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setLines(lines.filter((_, j) => j !== i))}
              disabled={lines.length <= 1}
              className="btn-neutral"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setLines([...lines, { product_id: products[0]?.product_id ?? 0, quantity: 1 }])
        }
        className="btn-secondary mb-btn-gap"
      >
        + Add line
      </button>

      <h2 className="form-section-title">Checkout defaults</h2>
      <p className="muted small-print">
        Payment / device / country are fixed for the demo; adjust in code if needed.
      </p>
      <label className="field field-promo field-promo-spacing">
        <span>Promo code (optional)</span>
        <input value={promo_code} onChange={(e) => setPromo(e.target.value)} />
      </label>

      {err && <p className="err">{err}</p>}

      <button type="submit" disabled={pending || products.length === 0}>
        {pending ? "Placing…" : "Place order"}
      </button>
    </form>
  );
}
