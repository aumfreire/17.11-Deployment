# IS 455 — Assignment 17.11 (Deployment)

Two deliverables live in this repo:

1. **Part 2 — CRISP-DM notebook:** [`fraud_detection_crispdm.ipynb`](fraud_detection_crispdm.ipynb) predicts `orders.is_fraud` (separate from the web app).
2. **Part 1 — Web app (Chapter 17):** Next.js app under [`web/`](web/) with SQLite [`db/shop.db`](db/shop.db), operational flows, and **late-delivery** scoring into `order_predictions` (not fraud).

## Supabase (PostgreSQL) from `shop.db`

Schema for Postgres (run in **Supabase → SQL**):

1. [`supabase/migrations/20250402120000_shop_schema.sql`](supabase/migrations/20250402120000_shop_schema.sql) — creates all tables, indexes, FKs.
2. After bulk-loading data with explicit IDs, run [`supabase/migrations/20250402120001_reset_sequences.sql`](supabase/migrations/20250402120001_reset_sequences.sql) **or** rely on the script below (it calls `setval`).

Copy rows from local SQLite (set **`DATABASE_URL`** to your Supabase pooler URI):

```bash
pip install -r requirements-supabase.txt
export DATABASE_URL="postgresql://..."
python3 scripts/sqlite_to_postgres.py
```

The Next.js app and Python jobs still target **SQLite** until you change them to use `DATABASE_URL` (separate task).

## Database setup (local SQLite)

Apply the Chapter 17 migration once (idempotent):

```bash
python3 db/migrate_ch17.py
```

This adds `orders.fulfilled`, backfills from `shipments`, and creates `order_predictions`.

**Note:** In the bundled dataset every historical order has a shipment, so **`fulfilled = 1` for all 5,000 rows** until you **place a new order** via the web UI (`fulfilled = 0`). The warehouse priority queue only lists **unfulfilled** orders **with predictions**, so the expected QA path is: select customer → place order → run scoring → open warehouse queue.

## Late-delivery model (Python)

Install job dependencies (system or venv):

```bash
pip install -r requirements-jobs.txt
```

Train and write `artifacts/late_delivery_model.joblib`:

```bash
python3 jobs/train_model.py
```

If **`run_inference.py`** prints **`InconsistentVersionWarning`** (model saved with a different scikit-learn than you’re running), **re-run training** on your machine so the `.joblib` matches your environment:

```bash
python3 jobs/train_model.py
```

Alternatively upgrade scikit-learn to match the version that created the artifact (`python3 -m pip install -U pip` first if installs fail).

Score open orders and upsert `order_predictions`:

```bash
python3 jobs/run_inference.py
```

This uses the same feature construction as training in [`jobs/feature_frame.py`](jobs/feature_frame.py). It is **not** the fraud model from the notebook.

## Web app (Next.js)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paths:

| Route | Purpose |
|--------|---------|
| `/debug/schema` | Table / column inspector |
| `/select-customer` | Sets `customer_id` cookie |
| `/dashboard` | Summary + 5 recent orders |
| `/place-order` | Multi-line insert (transaction) |
| `/orders` | History; detail at `/orders/[orderId]` |
| `/scoring` | Runs `python3 jobs/run_inference.py` via API |
| `/warehouse/priority` | Top 50 unfulfilled by predicted late risk |

### Environment

From `web/`, the default SQLite path resolves to **parent**/ `db/shop.db`. See [`web/.env.local.example`](web/.env.local.example) for `SHOP_REPO_ROOT`, `SHOP_DB_PATH`, and `PYTHON_PATH`.

**Run scoring** requires Python on the server with `requirements-jobs.txt` installed and working directory at the **repo root** (so `jobs/run_inference.py` and `db/shop.db` resolve).

## Deployment (Vercel vs equivalent)

**Vercel** is a poor fit for **local `better-sqlite3` + writable SQLite + spawning Python**. Use **Render**, **Railway**, **Fly.io**, or a **VPS** with a persistent disk, or submit your course’s “Vercel or equivalent” URL from one of those hosts.

## Project layout

```
db/shop.db              # operational SQLite
db/migrate_ch17.py      # schema alignment
jobs/                   # train + inference for late delivery
artifacts/              # late_delivery_model.joblib (+ fraud notebook artifact if present)
web/                    # Next.js app
```
