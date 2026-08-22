"""AutoML Training Engine for AutoMLOps.

Trains multiple ML models with lightning-fast hyperparameter exploration,
cross-validation, and comprehensive model comparison.
Supports both classification and regression tasks.
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.svm import SVC, SVR
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, mean_squared_error, mean_absolute_error, r2_score,
    confusion_matrix as sk_confusion_matrix,
)
import joblib
import time
import os
import warnings
from app.config import settings

warnings.filterwarnings('ignore')

# Optional libraries
try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    HAS_LIGHTGBM = True
except Exception:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostClassifier, CatBoostRegressor
    HAS_CATBOOST = True
except Exception:
    HAS_CATBOOST = False


def _get_classification_candidates() -> dict:
    """Get classification model variations for rapid, responsive training."""
    models = {
        'RandomForest': [
            (RandomForestClassifier(n_estimators=40, max_depth=8, random_state=42, n_jobs=1), {'n_estimators': 40, 'max_depth': 8}),
        ],
        'GradientBoosting': [
            (GradientBoostingClassifier(n_estimators=40, learning_rate=0.1, max_depth=3, random_state=42), {'n_estimators': 40, 'learning_rate': 0.1}),
        ],
        'LogisticRegression': [
            (LogisticRegression(C=1.0, max_iter=300, random_state=42), {'C': 1.0, 'solver': 'lbfgs'}),
        ],
        'SVM': [
            (SVC(C=1.0, kernel='rbf', probability=True, random_state=42), {'C': 1.0, 'kernel': 'rbf'}),
        ],
        'NeuralNetwork': [
            (MLPClassifier(hidden_layer_sizes=(32,), max_iter=60, random_state=42, early_stopping=True), {'hidden_layer_sizes': '(32,)', 'activation': 'relu'}),
        ],
    }

    if HAS_XGBOOST:
        models['XGBoost'] = [
            (XGBClassifier(n_estimators=40, max_depth=3, learning_rate=0.1, eval_metric='logloss', random_state=42, verbosity=0, n_jobs=1), {'n_estimators': 40, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_LIGHTGBM:
        models['LightGBM'] = [
            (LGBMClassifier(n_estimators=40, max_depth=4, learning_rate=0.1, random_state=42, verbosity=-1, n_jobs=1), {'n_estimators': 40, 'max_depth': 4, 'learning_rate': 0.1}),
        ]

    if HAS_CATBOOST:
        models['CatBoost'] = [
            (CatBoostClassifier(iterations=20, depth=4, learning_rate=0.1, random_state=42, verbose=0, thread_count=1), {'iterations': 20, 'depth': 4, 'learning_rate': 0.1}),
        ]

    return models


def _get_regression_candidates() -> dict:
    """Get regression model variations for rapid, responsive training."""
    models = {
        'RandomForest': [
            (RandomForestRegressor(n_estimators=40, max_depth=8, random_state=42, n_jobs=1), {'n_estimators': 40, 'max_depth': 8}),
        ],
        'GradientBoosting': [
            (GradientBoostingRegressor(n_estimators=40, learning_rate=0.1, max_depth=3, random_state=42), {'n_estimators': 40, 'learning_rate': 0.1}),
        ],
        'Ridge': [
            (Ridge(alpha=1.0, random_state=42), {'alpha': 1.0}),
        ],
        'LinearRegression': [
            (LinearRegression(), {'fit_intercept': True}),
        ],
        'SVR': [
            (SVR(C=1.0, kernel='rbf'), {'C': 1.0, 'kernel': 'rbf'}),
        ],
        'NeuralNetwork': [
            (MLPRegressor(hidden_layer_sizes=(32,), max_iter=60, random_state=42, early_stopping=True), {'hidden_layer_sizes': '(32,)', 'activation': 'relu'}),
        ],
    }

    if HAS_XGBOOST:
        models['XGBoost'] = [
            (XGBRegressor(n_estimators=40, max_depth=3, learning_rate=0.1, random_state=42, verbosity=0, n_jobs=1), {'n_estimators': 40, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_LIGHTGBM:
        models['LightGBM'] = [
            (LGBMRegressor(n_estimators=40, max_depth=4, learning_rate=0.1, random_state=42, verbosity=-1, n_jobs=1), {'n_estimators': 40, 'max_depth': 4, 'learning_rate': 0.1}),
        ]

    if HAS_CATBOOST:
        models['CatBoost'] = [
            (CatBoostRegressor(iterations=20, depth=4, learning_rate=0.1, random_state=42, verbose=0, thread_count=1), {'iterations': 20, 'depth': 4, 'learning_rate': 0.1}),
        ]

    return models


def _preprocess_features(X: pd.DataFrame) -> pd.DataFrame:
    """Ensure all feature columns are numeric, clean, and properly encoded."""
    X_clean = X.copy()
    
    for col in list(X_clean.columns):
        series = X_clean[col]
        if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series) or isinstance(series.dtype, pd.CategoricalDtype):
            nunique = series.nunique()
            if nunique > 20 and (nunique / len(series)) > 0.8:
                X_clean = X_clean.drop(columns=[col])
            elif nunique <= 10:
                dummies = pd.get_dummies(series, prefix=col, drop_first=True, dtype=float)
                X_clean = pd.concat([X_clean.drop(columns=[col]), dummies], axis=1)
            else:
                le = LabelEncoder()
                X_clean[col] = le.fit_transform(series.fillna("missing").astype(str)).astype(float)
        elif pd.api.types.is_datetime64_any_dtype(series):
            X_clean[f"{col}_year"] = series.dt.year.astype(float)
            X_clean[f"{col}_month"] = series.dt.month.astype(float)
            X_clean[f"{col}_day"] = series.dt.day.astype(float)
            X_clean = X_clean.drop(columns=[col])
            
    for col in X_clean.columns:
        if X_clean[col].isnull().any():
            val = X_clean[col].median() if not pd.isna(X_clean[col].median()) else 0.0
            X_clean[col] = X_clean[col].fillna(val)
        X_clean[col] = pd.to_numeric(X_clean[col], errors='coerce').fillna(0.0)
        
    return X_clean


def train_models(
    X: pd.DataFrame,
    y: pd.Series,
    task_type: str,
    project_id: str,
    test_size: float = 0.2,
    cv_folds: int = 5,
    scoring_metric: str = 'auto',
    models_to_train: list[str] | None = None,
) -> list[dict]:
    """Train multiple models with fast hyperparameter exploration and cross-validation."""
    X = _preprocess_features(X)
    
    # Handle target column
    if task_type == 'classification':
        if not pd.api.types.is_numeric_dtype(y):
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y.fillna("unknown").astype(str)), index=y.index)
        else:
            y = y.fillna(y.mode()[0] if len(y.mode()) > 0 else 0)
    else:
        y = pd.to_numeric(y, errors='coerce').fillna(y.mean() if not pd.isna(y.mean()) else 0.0)
    
    can_stratify = (
        task_type == 'classification' and 
        len(y) >= 10 and 
        (y.value_counts().min() >= 2)
    )
    
    if len(X) < 10:
        X_train, X_test, y_train, y_test = X, X, y, y
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y if can_stratify else None
        )
    
    candidates_dict = _get_classification_candidates() if task_type == 'classification' else _get_regression_candidates()
    
    if models_to_train:
        candidates_dict = {k: v for k, v in candidates_dict.items() if k in models_to_train}
    
    os.makedirs(settings.MODEL_REGISTRY_DIR, exist_ok=True)
    results = []
    
    for algo_name, candidate_list in candidates_dict.items():
        best_candidate = None
        best_candidate_params = {}
        best_candidate_score = -999999.0
        best_candidate_metrics = {}
        best_candidate_time = 0.0
        
        for model_obj, params_info in candidate_list:
            try:
                t0 = time.time()
                model_obj.fit(X_train, y_train)
                y_pred = model_obj.predict(X_test)
                fit_time = time.time() - t0
                
                metrics = {}
                if task_type == 'classification':
                    acc = float(accuracy_score(y_test, y_pred))
                    f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
                    prec = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
                    rec = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
                    
                    score = f1 if scoring_metric in ('auto', 'f1', 'f1_weighted') else acc
                    metrics['accuracy'] = round(acc, 4)
                    metrics['f1'] = round(f1, 4)
                    metrics['precision'] = round(prec, 4)
                    metrics['recall'] = round(rec, 4)
                    metrics['cv_score'] = round(score, 4)
                    
                    try:
                        if hasattr(model_obj, 'predict_proba'):
                            y_proba = model_obj.predict_proba(X_test)
                            if y.nunique() == 2:
                                metrics['roc_auc'] = round(float(roc_auc_score(y_test, y_proba[:, 1])), 4)
                            else:
                                metrics['roc_auc'] = round(float(roc_auc_score(y_test, y_proba, multi_class='ovr', average='weighted')), 4)
                    except Exception:
                        metrics['roc_auc'] = None
                    
                    cm = sk_confusion_matrix(y_test, y_pred)
                    metrics['confusion_matrix'] = cm.tolist()
                else:
                    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                    mae = float(mean_absolute_error(y_test, y_pred))
                    r2 = float(r2_score(y_test, y_pred))
                    score = r2
                    metrics['rmse'] = round(rmse, 4)
                    metrics['mae'] = round(mae, 4)
                    metrics['r2'] = round(r2, 4)
                    metrics['cv_score'] = round(r2, 4)
                
                if score > best_candidate_score:
                    best_candidate_score = score
                    best_candidate = model_obj
                    best_candidate_params = params_info
                    best_candidate_metrics = metrics
                    best_candidate_time = fit_time
            except Exception:
                continue
                
        if best_candidate is not None:
            model_filename = f"{project_id}_{algo_name}.joblib"
            model_path = os.path.join(settings.MODEL_REGISTRY_DIR, model_filename)
            joblib.dump(best_candidate, model_path)
            
            test_data_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{project_id}_{algo_name}_test_data.joblib")
            joblib.dump({'X_test': X_test, 'y_test': y_test, 'feature_names': X.columns.tolist()}, test_data_path)
            
            results.append({
                'algorithm': algo_name,
                'hyperparameters': best_candidate_params,
                'metrics': best_candidate_metrics,
                'model_path': model_path,
                'training_time_seconds': round(best_candidate_time, 2),
                'test_data_path': test_data_path,
            })
        else:
            results.append({
                'algorithm': algo_name,
                'hyperparameters': {},
                'metrics': {'error': 'Model training failed'},
                'model_path': "",
                'training_time_seconds': 0,
            })
    
    def sort_key(x):
        m = x.get('metrics', {})
        if 'error' in m:
            return -999.0
        if task_type == 'classification':
            return m.get('f1', m.get('accuracy', 0.0))
        else:
            return m.get('r2', -999.0)
    
    results.sort(key=sort_key, reverse=True)
    return results
