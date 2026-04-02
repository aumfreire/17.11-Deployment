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
    <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Lines</h2>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
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
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], quantity: Math.max(1, parseInt(e.target.value, 10) || 1) };
              setLines(next);
            }}
            style={{ width: 72 }}
          />
          <button
            type="button"
            onClick={() => setLines(lines.filter((_, j) => j !== i))}
            disabled={lines.length <= 1}
            style={{ background: "#444" }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setLines([...lines, { product_id: products[0]?.product_id ?? 0, quantity: 1 }])
        }
        style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)", marginBottom: "1rem" }}
      >
        + Add line
      </button>

      <h2>Checkout defaults</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 0 }}>
        Payment / device / country are fixed for the demo; adjust in code if needed.
      </p>
      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        Promo code (optional)
        <input value={promo_code} onChange={(e) => setPromo(e.target.value)} style={{ display: "block", marginTop: 4, width: "100%" }} />
      </label>

      {err && <p className="err">{err}</p>}

      <button type="submit" disabled={pending || products.length === 0}>
        {pending ? "Placing…" : "Place order"}
      </button>
    </form>
  );
}
