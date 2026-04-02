"""Build late-delivery feature matrices from shop.db (shared train + inference)."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "db" / "shop.db"

AGG_SUB = """
SELECT
  order_id,
  COUNT(*) AS line_count,
  SUM(quantity) AS sum_qty,
  COUNT(DISTINCT product_id) AS n_products
FROM order_items
GROUP BY order_id
"""

TRAIN_SQL = f"""
SELECT
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
  COALESCE(ag.n_products, 0) AS n_products,
  s.late_delivery AS late_delivery
FROM orders o
JOIN shipments s ON s.order_id = o.order_id
LEFT JOIN customers c ON c.customer_id = o.customer_id
LEFT JOIN ({AGG_SUB.strip()}) ag ON ag.order_id = o.order_id
"""

SCORE_SQL = f"""
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
LEFT JOIN ({AGG_SUB.strip()}) ag ON ag.order_id = o.order_id
WHERE o.fulfilled = 0
"""

CAT_COLS = [
    "billing_zip",
    "shipping_zip",
    "shipping_state",
    "payment_method",
    "device_type",
    "ip_country",
    "promo_code",
    "customer_segment",
    "loyalty_tier",
    "gender",
    "city",
    "customer_state",
]
NUM_COLS = [
    "promo_used",
    "order_subtotal",
    "shipping_fee",
    "tax_amount",
    "order_total",
    "risk_score",
    "is_fraud",
    "line_count",
    "sum_qty",
    "n_products",
    "order_hour",
    "order_dow",
    "billing_equals_shipping",
]


def _engineer(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["order_datetime"] = pd.to_datetime(out["order_datetime"], errors="coerce")
    out["order_hour"] = out["order_datetime"].dt.hour.astype(float)
    out["order_dow"] = out["order_datetime"].dt.dayofweek.astype(float)
    out["billing_equals_shipping"] = (
        out["billing_zip"].fillna("").astype(str)
        == out["shipping_zip"].fillna("").astype(str)
    ).astype(int).astype(float)
    out.drop(columns=["order_datetime"], inplace=True)
    for c in CAT_COLS:
        if c in out.columns:
            out[c] = out[c].astype(str).where(out[c].notna(), other=np.nan)
    return out


def load_training_frame(db_path: Path | None = None) -> tuple[pd.DataFrame, pd.Series]:
    conn = sqlite3.connect(db_path or DEFAULT_DB)
    df = pd.read_sql_query(TRAIN_SQL, conn)
    conn.close()
    y = df["late_delivery"].astype(int)
    df = df.drop(columns=["late_delivery"])
    df = _engineer(df)
    X = df
    return X, y


def load_scoring_frame(db_path: Path | None = None) -> pd.DataFrame:
    conn = sqlite3.connect(db_path or DEFAULT_DB)
    df = pd.read_sql_query(SCORE_SQL, conn)
    conn.close()
    df = _engineer(df)
    return df


def feature_matrix(score_df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray | None]:
    """Return X and order_ids (from score_df)."""
    if "order_id" not in score_df.columns:
        raise ValueError("score_df must contain order_id")
    ids = score_df["order_id"].to_numpy()
    X = score_df.drop(columns=["order_id"])
    return X, ids
