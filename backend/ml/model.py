"""
AQUASENSE - Model loading + inference with real SHAP explanations.

The trained XGBoost booster gives exact TreeSHAP contributions via pred_contribs=True,
so every explanation shown in the UI comes from the model itself.
"""
from __future__ import annotations
import json, pathlib
import numpy as np
import pandas as pd
import xgboost as xgb

from pipeline.features import FEATURE_LABELS

MODEL_DIR = pathlib.Path(__file__).resolve().parents[1] / "models"
LEVELS = ["LOW", "MEDIUM", "HIGH", "SEVERE"]


class _Calibrator:
    """Isotonic calibration stored as plain numbers (works with any library version)."""
    def __init__(self, x, y):
        self.x, self.y = np.asarray(x, float), np.asarray(y, float)

    def predict(self, raw):
        return np.interp(np.asarray(raw, float), self.x, self.y)


def _load(model_dir):
    meta = json.loads((model_dir / "model_meta.json").read_text())
    booster = xgb.Booster()
    booster.load_model(str(model_dir / "risk_model.json"))
    cal = json.loads((model_dir / "calibrator.json").read_text())
    # smoke test: the model must score a row with the right number of features
    booster.predict(xgb.DMatrix(np.zeros((1, len(meta["features"]))), feature_names=meta["features"]))
    return meta, booster, _Calibrator(cal["x"], cal["y"])


class FloodModel:
    def __init__(self, model_dir: pathlib.Path = MODEL_DIR):
        try:
            self.meta, self.booster, self.calibrator = _load(model_dir)
        except Exception as e:  # missing files or saved by a different library version
            print(f"[model] could not load saved model ({e!r}); training a fresh one now (about 1 minute)...", flush=True)
            from ml.train import run
            run(quick=True)
            self.meta, self.booster, self.calibrator = _load(model_dir)
        self.features: list[str] = self.meta["features"]
        self.thresholds: dict = self.meta["thresholds"]
        self.drainage_index: dict = self.meta["drainage_index"]
        self.incident_freq: dict = self.meta["incident_freq"]
        self.version = self.meta.get("version", "v3")

    def _matrix(self, rows) -> xgb.DMatrix:
        X = pd.DataFrame(rows)[self.features].astype(float)
        return xgb.DMatrix(X, feature_names=self.features)

    def predict(self, rows: list[dict]) -> np.ndarray:
        if not rows:
            return np.zeros(0)
        raw = self.booster.predict(self._matrix(rows))
        return np.clip(self.calibrator.predict(raw), 0.001, 0.99)   # never claim certainty

    def explain(self, row: dict, top: int = 6) -> list[dict]:
        """Exact TreeSHAP contributions (log-odds) for one zone-hour, largest first."""
        contrib = self.booster.predict(self._matrix([row]), pred_contribs=True)[0][:-1]
        order = np.argsort(-np.abs(contrib))[:top]
        return [{
            "feature_name": self.features[i],
            "display_name": FEATURE_LABELS.get(self.features[i], self.features[i]),
            "importance_score": round(float(contrib[i]), 3),
            "direction": "increases_risk" if contrib[i] > 0 else "decreases_risk",
            "value": float(row[self.features[i]]),
        } for i in order]

    def level(self, p: float) -> str:
        t = self.thresholds
        return "SEVERE" if p >= t["SEVERE"] else "HIGH" if p >= t["HIGH"] else "MEDIUM" if p >= t["MEDIUM"] else "LOW"
