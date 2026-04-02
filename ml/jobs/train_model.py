#!/usr/bin/env python3
"""Train late-delivery classifier from orders with shipment labels; save sklearn pipeline."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

JOB_DIR = Path(__file__).resolve().parent
if str(JOB_DIR) not in sys.path:
    sys.path.insert(0, str(JOB_DIR))

import joblib
from feature_frame import CAT_COLS, NUM_COLS, ROOT, load_training_frame
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_pipeline() -> Pipeline:
    numeric_tf = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_tf = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    max_categories=25,
                    sparse_output=False,
                ),
            ),
        ]
    )
    prep = ColumnTransformer(
        [
            ("num", numeric_tf, NUM_COLS),
            ("cat", categorical_tf, CAT_COLS),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    clf = HistGradientBoostingClassifier(
        learning_rate=0.06,
        max_depth=6,
        max_iter=200,
        class_weight="balanced",
        random_state=42,
    )
    return Pipeline([("prep", prep), ("clf", clf)])


def main() -> None:
    artifact_dir = ROOT / "ml" / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    model_path = artifact_dir / "late_delivery_model.joblib"
    meta_path = artifact_dir / "late_delivery_model_metadata.json"

    X, y = load_training_frame()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    pipe = build_pipeline()
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    meta = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "task": "late_delivery",
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "roc_auc_holdout": float(roc_auc_score(y_test, proba)),
        "average_precision_holdout": float(average_precision_score(y_test, proba)),
    }
    joblib.dump(pipe, model_path)
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("Saved", model_path)
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
