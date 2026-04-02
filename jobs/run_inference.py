#!/usr/bin/env python3
"""Score unfulfilled orders; upsert order_predictions."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

JOB_DIR = Path(__file__).resolve().parent
if str(JOB_DIR) not in sys.path:
    sys.path.insert(0, str(JOB_DIR))

import joblib
import sqlite3

from feature_frame import ROOT, feature_matrix, load_scoring_frame

MODEL_PATH = ROOT / "artifacts" / "late_delivery_model.joblib"
DB_PATH = ROOT / "db" / "shop.db"

UPSERT_SQL = """
INSERT INTO order_predictions (
  order_id,
  late_delivery_probability,
  predicted_late_delivery,
  prediction_timestamp
) VALUES (?, ?, ?, ?)
ON CONFLICT(order_id) DO UPDATE SET
  late_delivery_probability = excluded.late_delivery_probability,
  predicted_late_delivery = excluded.predicted_late_delivery,
  prediction_timestamp = excluded.prediction_timestamp
"""


def main() -> None:
    if not MODEL_PATH.exists():
        raise SystemExit(
            f"Missing model {MODEL_PATH}. Run: python3 jobs/train_model.py"
        )
    pipe = joblib.load(MODEL_PATH)
    score_df = load_scoring_frame(DB_PATH)
    if score_df.empty:
        print("Scored 0 orders")
        return

    X, order_ids = feature_matrix(score_df)
    probas = pipe.predict_proba(X)[:, 1]
    preds = (probas >= 0.5).astype(int)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    n = 0
    # zip(strict=...) requires Python 3.10+; keep 3.9-compatible.
    for oid, p, yhat in zip(order_ids, probas, preds):
        cur.execute(UPSERT_SQL, (int(oid), float(p), int(yhat), ts))
        n += 1
    conn.commit()
    conn.close()
    print(f"Scored {n} orders")


if __name__ == "__main__":
    main()
