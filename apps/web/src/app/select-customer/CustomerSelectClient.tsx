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
    <div>
      <label htmlFor="search" style={{ display: "block", marginBottom: "0.35rem" }}>
        Search name, email, or ID
      </label>
      <input
        id="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to filter…"
        style={{ width: "100%", maxWidth: 420, marginBottom: "1rem" }}
      />
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Location</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map((c) => (
            <tr key={c.customer_id}>
              <td>{c.customer_id}</td>
              <td>{c.full_name}</td>
              <td>{c.email}</td>
              <td>
                {[c.city, c.state].filter(Boolean).join(", ") || "—"}
              </td>
              <td>
                <form action={selectCustomerAction}>
                  <input type="hidden" name="customer_id" value={c.customer_id} />
                  <button type="submit">Select</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 200 && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Showing first 200 matches. Refine search to narrow the list.
        </p>
      )}
    </div>
  );
}
