"use client";

import { useMemo, useState } from "react";
import { selectCustomerAction } from "./actions";

type Row = {
  customer_id: number;
  full_name: string;
  email: string;
  city: string | null;
  state: string | null;
};

export function CustomerSelectClient({ customers }: { customers: Row[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        String(c.customer_id).includes(s),
    );
  }, [customers, q]);

  return (
    <div className="stack">
      <div className="toolbar">
        <label htmlFor="search" className="field">
          <span>Search by name, email, or customer ID</span>
          <input
            id="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try: 'Olivia', '@gmail.com', or '1024'"
            className="search-input"
          />
        </label>
        <span className="badge">
          {Math.min(filtered.length, 200)} shown / {customers.length} active
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          No customers match your search. Try fewer terms or search by ID.
        </div>
      ) : (
        <div className="customer-grid">
          {filtered.slice(0, 200).map((c) => (
            <article className="customer-card" key={c.customer_id}>
              <div>
                <div className="customer-name">{c.full_name}</div>
                <div className="customer-meta">{c.email}</div>
              </div>
              <div className="customer-foot">
                <span className="badge">ID {c.customer_id}</span>
                <span className="customer-meta">
                  {[c.city, c.state].filter(Boolean).join(", ") || "Location unavailable"}
                </span>
              </div>
              <form action={selectCustomerAction} className="inline-form">
                <input type="hidden" name="customer_id" value={c.customer_id} />
                <button type="submit">Use this customer</button>
              </form>
            </article>
          ))}
        </div>
      )}

      {filtered.length > 200 && (
        <p className="muted">Showing first 200 matches. Refine your search to narrow the list.</p>
      )}
    </div>
  );
}
