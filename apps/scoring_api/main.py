from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException

# Ensure repo root is on sys.path so we can import shared feature utilities.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

MODEL_PATH = Path(os.getenv("LATE_MODEL_PATH", ROOT / "ml" / "artifacts" / "late_delivery_model.joblib"))
DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL")
SHARED_SECRET = os.getenv("SCORING_SHARED_SECRET")

SCORE_SQL = """
SELECT
  o.order_id,
  o.billing_zip,
  o.shipping_zip,
  o.shipping_state,
  o.payment_method,
  o.device_type,
  o.ip_country,
  o.promo_used,
  o.promo_code,
  o.order_subtotal,
  o.shipping_fee,
  o.tax_amount,
  o.order_total,
  o.risk_score,
  o.is_fraud,
  o.order_datetime,
  c.customer_segment,
  c.loyalty_tier,
  c.gender,
  c.city,
  c.state AS customer_state,
  COALESCE(ag.line_count, 0) AS line_count,
  COALESCE(ag.sum_qty, 0) AS sum_qty,
  COALESCE(ag.n_products, 0) AS n_products
FROM orders o
LEFT JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN (
  SELECT
    order_id,
    COUNT(*) AS line_count,
    SUM(quantity) AS sum_qty,
    COUNT(DISTINCT product_id) AS n_products
  FROM order_items
  GROUP BY order_id
) ag ON ag.order_id = o.order_id
WHERE COALESCE((o.fulfilled)::int, 0) = 0
"""

UPSERT_SQL = """
INSERT INTO order_predictions (
  order_id,
  late_delivery_probability,
  predicted_late_delivery,
  prediction_timestamp
) VALUES (%s, %s, %s, %s)
ON CONFLICT (order_id) DO UPDATE SET
  late_delivery_probability = EXCLUDED.late_delivery_probability,
  predicted_late_delivery = EXCLUDED.predicted_late_delivery,
  prediction_timestamp = EXCLUDED.prediction_timestamp
"""

app = FastAPI(title="late-delivery-scoring-api")


def _require_env() -> None:
  if not DATABASE_URL:
    raise HTTPException(status_code=500, detail="Missing SUPABASE_DATABASE_URL or DATABASE_URL")
  if not MODEL_PATH.exists():
    raise HTTPException(status_code=500, detail=f"Missing model artifact at {MODEL_PATH}")


def _check_secret(header_value: str | None) -> None:
  if not SHARED_SECRET:
    return
  if not header_value or header_value != SHARED_SECRET:
    raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, object]:
  ok = True
  return {
    "ok": ok,
    "databaseConfigured": bool(DATABASE_URL),
    "modelExists": MODEL_PATH.exists(),
    "modelPath": str(MODEL_PATH),
  }


@app.post("/score")
def score(x_scoring_secret: str | None = Header(default=None)) -> dict[str, object]:
  _check_secret(x_scoring_secret)
  _require_env()

  # Defer heavy imports so deployment healthcheck can pass even if runtime deps fail.
  try:
    import joblib
    import pandas as pd
    from psycopg import connect
    from ml.jobs.feature_frame import _engineer, feature_matrix
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Runtime dependency import failed: {exc}") from exc

  model = joblib.load(MODEL_PATH)

  with connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
      cur.execute(SCORE_SQL)
      cols = [desc[0] for desc in cur.description]
      score_df = pd.DataFrame(cur.fetchall(), columns=cols)

    if score_df.empty:
      return {"ok": True, "message": "Scored 0 orders", "scored": 0}

    score_df = _engineer(score_df)
    X, order_ids = feature_matrix(score_df)

    probas = model.predict_proba(X)[:, 1]
    preds = (probas >= 0.5).astype(int)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    rows = [
      (int(oid), float(prob), int(pred), ts)
      for oid, prob, pred in zip(order_ids, probas, preds)
    ]

    with conn.cursor() as cur:
      cur.executemany(UPSERT_SQL, rows)
    conn.commit()

  return {
    "ok": True,
    "message": f"Scored {len(rows)} orders",
    "scored": len(rows),
  }
