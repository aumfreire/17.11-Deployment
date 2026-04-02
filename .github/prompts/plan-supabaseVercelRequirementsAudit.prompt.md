## Plan: Supabase/Vercel Requirements Audit

The repo is already split correctly into two deliverables: the notebook is the fraud pipeline, and the web app is the Chapter 17 late-delivery workflow. The main gap is deployment: the web app still relies on local SQLite plus a Python spawn path, which is not Vercel-friendly. The plan is to keep the fraud notebook separate, migrate the web app to Supabase Postgres, and remove the current local-runtime assumptions from the deploy path.

**Steps**
1. Audit the assignment requirements against the current repo and lock scope.
   - Confirm the notebook is responsible for `orders.is_fraud` and the web app is responsible for late-delivery scoring.
   - Treat the notebook as the CRISP-DM deliverable and the web app as the Supabase/Vercel deliverable.
   - Mark which current features already satisfy the prompt versus which are only scaffolded.
2. Preserve the current data before any destructive change.
   - Back up `db/shop.db`, the current `artifacts/` contents, and any locally generated deployment state before migration work.
   - Keep the SQLite database as the source-of-truth reference until Supabase is verified.
3. Migrate the web app data layer from SQLite to Supabase Postgres.
   - Replace the direct `better-sqlite3` access path in `web/src/lib/db.ts` with a Postgres-compatible server data layer driven by `DATABASE_URL`.
   - Rework the route handlers and server actions that currently depend on SQLite semantics so they use the Supabase schema and transactions safely.
   - Keep the existing Supabase migration files and the SQLite-to-Postgres copy script as the source of truth for schema and data loading.
4. Make the scoring flow deployment-safe for Vercel.
   - Remove the current assumption that the web app can spawn local Python during request handling.
   - Split inference into a deployable job boundary so the UI can trigger scoring without depending on the Vercel runtime having a writable filesystem or a Python interpreter.
   - Preserve the `Run scoring` UX and the `order_predictions` table contract.
5. Validate the notebook against the CRISP-DM rubric.
   - Verify the notebook has business understanding, data understanding, preparation, modeling, evaluation, feature selection, and serialization sections.
   - Execute it end-to-end so the saved artifact and metadata are reproducible on the current machine.
   - Confirm the notebook uses `is_fraud` and does not drift into the late-delivery web-app target.
6. Verify the end-to-end deployment paths.
   - Confirm Supabase contains the migrated schema, data, and `order_predictions` table.
   - Confirm the web app can run against Supabase and still supports select customer, dashboard, place order, order history, warehouse queue, and scoring.
   - Update the README and deployment notes so the repo clearly states what runs on Supabase, what runs on Vercel, and what remains local-only.

**Relevant files**
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/fraud_detection_crispdm.ipynb` — fraud notebook that should stay focused on `is_fraud`.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/README.md` — currently documents the notebook/web split and the Vercel limitation.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/lib/db.ts` — SQLite-only data access layer that blocks Vercel/Supabase deployment.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/lib/paths.ts` — environment/path resolution for DB and Python execution.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/app/api/scoring/route.ts` — current Python-spawn scoring path.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/app/place-order/actions.ts` — transactional order creation path.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/app/select-customer/actions.ts` — customer selection flow.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/src/app/warehouse/priority/page.tsx` — queue query that depends on `order_predictions`.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/db/migrate_ch17.py` and `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/db/migrate_ch17.sql` — local schema alignment for Chapter 17.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/scripts/sqlite_to_postgres.py` and `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/db/migrate_to_supabase.py` — SQLite to Supabase migration paths.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/supabase/migrations/20250402120000_shop_schema.sql` and `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/supabase/migrations/20250402120001_reset_sequences.sql` — Supabase schema and sequence reset.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/jobs/feature_frame.py`, `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/jobs/train_model.py`, `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/jobs/run_inference.py` — feature engineering, training, and scoring pipeline.
- `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/package.json` and `/Users/augusto.freire/CS Projects/IS 455/17.11 Deployment/web/next.config.ts` — current SQLite-oriented web stack configuration.

**Verification**
1. Run the notebook end-to-end and confirm every section executes, the model artifact is written, and the metadata matches the intended fraud target.
2. Load the local SQLite schema, migrate a copy into Supabase, and verify row counts plus foreign-key integrity.
3. Exercise the web app against the target database and confirm each route behaves correctly with a selected customer and a newly placed order.
4. Trigger scoring and verify predictions populate `order_predictions`, then confirm the warehouse queue ranks the new unfulfilled order as expected.
5. Build the web app in the target deployment configuration and confirm it does not depend on a local SQLite file or a spawned Python process.

**Decisions**
- The notebook stays focused on fraud prediction and is treated as a separate deliverable from the Chapter 17 web app.
- The web app target is Supabase Postgres plus Vercel, so the current SQLite/Python request path must be refactored or isolated behind a deployable job boundary.
- No destructive database changes should happen until backups are taken first.

**Further Considerations**
1. If you want the strictest possible assignment alignment, keep the notebook and the web app as separate deliverables and avoid mixing the fraud model into the Chapter 17 UI.
2. If you want the smallest code change set, keep the current Chapter 17 UX and only swap the data layer plus the scoring execution path, rather than redesigning the app structure.
