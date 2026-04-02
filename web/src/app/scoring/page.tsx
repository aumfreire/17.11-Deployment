"use client";

import { useState } from "react";

export default function ScoringPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setMsg(null);
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/scoring", { method: "POST" });
      const data = (await r.json()) as { ok?: boolean; stdout?: string; stderr?: string; error?: string };
      if (!r.ok) {
        setErr(data.stderr || data.error || JSON.stringify(data));
        return;
      }
      setMsg(data.stdout || "OK");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Run scoring</h1>
      <p style={{ color: "var(--muted)" }}>
        Calls <code>python3 jobs/run_inference.py</code> at the repo root (late-delivery model →{" "}
        <code>order_predictions</code>).
      </p>
      <button type="button" onClick={run} disabled={loading}>
        {loading ? "Running…" : "Run inference"}
      </button>
      {msg && <p className="ok">{msg}</p>}
      {err && <pre className="err" style={{ whiteSpace: "pre-wrap" }}>{err}</pre>}
    </div>
  );
}
