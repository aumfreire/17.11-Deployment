# IS 455 — Assignment 17.11 (Deployment)

Two deliverables live in this repo:

1. **Part 2 — CRISP-DM notebook:** [`ml/notebooks/fraud_detection_crispdm.ipynb`](ml/notebooks/fraud_detection_crispdm.ipynb) predicts `orders.is_fraud` (separate from the web app).
2. **Part 1 — Web app (Chapter 17):** Next.js app under [`apps/web/`](apps/web/) with operational flows, Supabase-ready PostgreSQL support via `DATABASE_URL`, and **late-delivery** scoring into `order_predictions` (not fraud).

## Supabase (PostgreSQL) from `shop.db`

Schema for Postgres (run in **Supabase → SQL**):

1. [`infra/supabase/migrations/20250402120000_shop_schema.sql`](infra/supabase/migrations/20250402120000_shop_schema.sql) — creates all tables, indexes, FKs.
2. After bulk-loading data with explicit IDs, run [`infra/supabase/migrations/20250402120001_reset_sequences.sql`](infra/supabase/migrations/20250402120001_reset_sequences.sql) **or** rely on the script below (it calls `setval`).

Copy rows from local SQLite (set **`DATABASE_URL`** to your Supabase pooler URI):

```bash
pip install -r requirements-supabase.txt
export DATABASE_URL="postgresql://..."
python3 tools/scripts/sqlite_to_postgres.py
```

The Next.js app now uses `DATABASE_URL` when it is set and falls back to local SQLite for development.

## Database setup (local SQLite)

Apply the Chapter 17 migration once (idempotent):

```bash
python3 data/migrations/local/migrate_ch17.py
```

This adds `orders.fulfilled`, backfills from `shipments`, and creates `order_predictions`.

**Note:** In the bundled dataset every historical order has a shipment, so **`fulfilled = 1` for all 5,000 rows** until you **place a new order** via the web UI (`fulfilled = 0`). The warehouse priority queue only lists **unfulfilled** orders **with predictions**, so the expected QA path is: select customer → place order → run scoring → open warehouse queue.

## Late-delivery model (Python)

Install job dependencies (system or venv):

```bash
pip install -r requirements-jobs.txt
```

Train and write `ml/artifacts/late_delivery_model.joblib`:

```bash
python3 ml/jobs/train_model.py
```

If **`run_inference.py`** prints **`InconsistentVersionWarning`** (model saved with a different scikit-learn than you’re running), **re-run training** on your machine so the `.joblib` matches your environment:

```bash
python3 ml/jobs/train_model.py
```

If loading fails with a pickle `AttributeError`, reinstall job dependencies (which pin sklearn for artifact compatibility) and retrain:

```bash
python3 -m pip install -r requirements-jobs.txt
python3 ml/jobs/train_model.py
```

Score open orders and upsert `order_predictions`:

```bash
python3 ml/jobs/run_inference.py
```

This uses the same feature construction as training in [`ml/jobs/feature_frame.py`](ml/jobs/feature_frame.py). It is **not** the fraud model from the notebook.

## Web app (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paths:

| Route                 | Purpose                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `/debug/schema`       | Table / column inspector                                                                       |
| `/select-customer`    | Sets `customer_id` cookie                                                                      |
| `/dashboard`          | Summary + 5 recent orders                                                                      |
| `/place-order`        | Multi-line insert (transaction)                                                                |
| `/orders`             | History; detail at `/orders/[orderId]`                                                         |
| `/scoring`            | Calls `SCORING_URL` when configured, otherwise runs `python3 ml/jobs/run_inference.py` locally |
| `/warehouse/priority` | Top 50 unfulfilled by predicted late risk                                                      |

### Environment

From `apps/web/`, the app uses `DATABASE_URL` when present. See [`apps/web/.env.local.example`](apps/web/.env.local.example) for `SHOP_REPO_ROOT`, `SHOP_DB_PATH`, `PYTHON_PATH`, `DATABASE_URL`, and `SCORING_URL`.

**Run scoring** works locally with Python on the server and `requirements-jobs.txt` installed. In production, set `SCORING_URL` to an external job endpoint that can run `ml/jobs/run_inference.py` against Supabase.

## Deployment (Supabase + Vercel)

1. Create the Supabase database.
   - Run [`infra/supabase/migrations/20250402120000_shop_schema.sql`](infra/supabase/migrations/20250402120000_shop_schema.sql) in the Supabase SQL editor.
   - Run [`infra/supabase/migrations/20250402120001_reset_sequences.sql`](infra/supabase/migrations/20250402120001_reset_sequences.sql) after loading data.
   - Load the SQLite data with [`tools/scripts/sqlite_to_postgres.py`](tools/scripts/sqlite_to_postgres.py) or [`tools/scripts/migrate_to_supabase.py`](tools/scripts/migrate_to_supabase.py) using `DATABASE_URL`.
2. Deploy the Next.js app to Vercel.
   - Set `DATABASE_URL` to the Supabase pooler connection string.
   - Set `SCORING_URL` to an external Python job endpoint if you want the `Run scoring` button to work in production.
   - Set `SHOP_REPO_ROOT` only if the app root is not the repo root.
3. Deploy scoring as a separate Python service.
   - Any host that can run `ml/jobs/run_inference.py` works, such as Render, Railway, Fly.io, or a VPS.
   - The service should expose a `POST` endpoint that Vercel can call through `SCORING_URL`.

## Project layout

```
apps/web/                       # Next.js app
data/sqlite/shop.db             # operational SQLite
data/migrations/local/          # local SQLite migration scripts
ml/notebooks/                   # CRISP-DM notebook deliverable
ml/jobs/                        # train + inference for late delivery
ml/artifacts/                   # model artifacts and metadata
infra/supabase/migrations/      # Supabase schema migrations
tools/scripts/                  # migration/import utilities
docs/reference/                 # local reference docs (gitignored PDFs)
```
