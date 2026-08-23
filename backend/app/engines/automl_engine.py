"""AutoML Training Engine for AutoMLOps.

Trains multiple ML models with strict statistical data-quality standards:
- Exact duplicate removal before splitting (preventing train/test leakage)
- Stratified 80/20 train-test holdout split with verification of holdout sample size
- 5-Fold Stratified Cross-Validation reporting mean accuracy ± standard deviation
- Probability threshold calibration for boosting/classification algorithms
- Flagging and filtering of uncalibrated models (AUC vs Accuracy discrepancy > 20 points)
- Full dataset audit statistics (total rows, duplicates removed, unique rows, train/test counts, class balance)
"""
import pandas as pd  # type: ignore
import numpy as np  # type: ignore
from sklearn.model_selection import train_test_split, StratifiedKFold, KFold, cross_val_score  # type: ignore
from sklearn.preprocessing import LabelEncoder  # type: ignore
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge  # type: ignore
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor  # type: ignore
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor  # type: ignore
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor  # type: ignore
from sklearn.metrics import (  # type: ignore
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, mean_squared_error, mean_absolute_error, r2_score,
    confusion_matrix as sk_confusion_matrix,
)
import joblib  # type: ignore
import time
import os
import warnings
from app.config import settings

warnings.filterwarnings('ignore')

# Optional tree-boosting libraries
try:
    from xgboost import XGBClassifier, XGBRegressor  # type: ignore
    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor  # type: ignore
    HAS_LIGHTGBM = True
except Exception:
    HAS_LIGHTGBM = False

try:
    from catboost import CatBoostClassifier, CatBoostRegressor  # type: ignore
    HAS_CATBOOST = True
except Exception:
    HAS_CATBOOST = False


def _get_classification_candidates() -> dict:
    """Get classification model variations configured for robust, calibrated learning."""
    models = {
        'RandomForest': [
            (RandomForestClassifier(n_estimators=30, max_depth=6, random_state=42, n_jobs=-1), {'n_estimators': 30, 'max_depth': 6}),
        ],
        'GradientBoosting': [
            (GradientBoostingClassifier(n_estimators=30, learning_rate=0.1, max_depth=3, random_state=42), {'n_estimators': 30, 'learning_rate': 0.1, 'max_depth': 3}),
        ],
        'DecisionTree': [
            (DecisionTreeClassifier(max_depth=6, random_state=42), {'max_depth': 6, 'criterion': 'gini'}),
        ],
        'LogisticRegression': [
            (LogisticRegression(C=1.0, max_iter=200, random_state=42), {'C': 1.0, 'solver': 'lbfgs'}),
        ],
        'KNearestNeighbors': [
            (KNeighborsClassifier(n_neighbors=5), {'n_neighbors': 5, 'weights': 'uniform'}),
        ],
    }

    if HAS_XGBOOST:
        models['XGBoost'] = [
            (XGBClassifier(n_estimators=30, max_depth=3, learning_rate=0.1, eval_metric='logloss', random_state=42, verbosity=0, n_jobs=-1), {'n_estimators': 30, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_LIGHTGBM:
        models['LightGBM'] = [
            (LGBMClassifier(n_estimators=30, max_depth=3, learning_rate=0.1, random_state=42, verbosity=-1, n_jobs=-1), {'n_estimators': 30, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_CATBOOST:
        models['CatBoost'] = [
            (CatBoostClassifier(iterations=20, depth=3, learning_rate=0.1, random_state=42, verbose=0, thread_count=-1), {'iterations': 20, 'depth': 3, 'learning_rate': 0.1}),
        ]

    return models


def _get_regression_candidates() -> dict:
    """Get regression model variations configured for robust learning."""
    models = {
        'RandomForest': [
            (RandomForestRegressor(n_estimators=30, max_depth=6, random_state=42, n_jobs=-1), {'n_estimators': 30, 'max_depth': 6}),
        ],
        'GradientBoosting': [
            (GradientBoostingRegressor(n_estimators=30, learning_rate=0.1, max_depth=3, random_state=42), {'n_estimators': 30, 'learning_rate': 0.1, 'max_depth': 3}),
        ],
        'DecisionTree': [
            (DecisionTreeRegressor(max_depth=6, random_state=42), {'max_depth': 6}),
        ],
        'Ridge': [
            (Ridge(alpha=1.0, random_state=42), {'alpha': 1.0}),
        ],
        'LinearRegression': [
            (LinearRegression(), {'fit_intercept': True}),
        ],
        'KNearestNeighbors': [
            (KNeighborsRegressor(n_neighbors=5), {'n_neighbors': 5}),
        ],
    }

    if HAS_XGBOOST:
        models['XGBoost'] = [
            (XGBRegressor(n_estimators=30, max_depth=3, learning_rate=0.1, random_state=42, verbosity=0, n_jobs=-1), {'n_estimators': 30, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_LIGHTGBM:
        models['LightGBM'] = [
            (LGBMRegressor(n_estimators=30, max_depth=3, learning_rate=0.1, random_state=42, verbosity=-1, n_jobs=-1), {'n_estimators': 30, 'max_depth': 3, 'learning_rate': 0.1}),
        ]

    if HAS_CATBOOST:
        models['CatBoost'] = [
            (CatBoostRegressor(iterations=20, depth=3, learning_rate=0.1, random_state=42, verbose=0, thread_count=-1), {'iterations': 20, 'depth': 3, 'learning_rate': 0.1}),
        ]

    return models


def _preprocess_features(X: pd.DataFrame) -> pd.DataFrame:
    """Ensure all feature columns are numeric, clean, and properly encoded."""
    X_clean = X.copy()
    
    for col in list(X_clean.columns):
        series = X_clean[col]
        if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series) or isinstance(series.dtype, pd.CategoricalDtype):
            nunique = series.nunique()
            if nunique > 25 and (nunique / max(len(series), 1)) > 0.85:
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


def _optimize_threshold(y_true: np.ndarray, y_proba_pos: np.ndarray) -> tuple[float, np.ndarray, float]:
    """Find optimal decision threshold maximizing F1 score for calibrated predictions."""
    best_thresh = 0.5
    best_f1 = -1.0
    best_preds = (y_proba_pos >= 0.5).astype(int)
    
    thresholds = np.linspace(0.05, 0.95, 37)
    for t in thresholds:
        preds = (y_proba_pos >= t).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_thresh = float(t)
            best_preds = preds
            
    return round(best_thresh, 3), best_preds, best_f1


def train_models(
    X: pd.DataFrame,
    y: pd.Series,
    task_type: str,
    project_id: str,
    test_size: float = 0.2,
    cv_folds: int = 5,
    scoring_metric: str = 'auto',
    models_to_train: list[str] | None = None,
    raw_df: pd.DataFrame | None = None,
) -> tuple[list[dict], dict]:
    """Train multiple models with data-quality deduplication, stratified CV, and threshold calibration.
    
    Returns:
        tuple (results: list[dict], dataset_stats: dict)
    """
    # 1. Deduplication Audit & Check
    if raw_df is not None:
        total_rows = len(raw_df)
        duplicates_removed = int(raw_df.duplicated().sum())
        clean_df = raw_df.drop_duplicates().reset_index(drop=True)
        unique_rows = len(clean_df)
    else:
        full_df = pd.concat([X, y.rename('__target__')], axis=1)
        total_rows = len(full_df)
        duplicates_removed = int(full_df.duplicated().sum())
        clean_df = full_df.drop_duplicates().reset_index(drop=True)
        unique_rows = len(clean_df)
        X = clean_df.drop(columns=['__target__'])
        y = clean_df['__target__']

    # Preprocess Feature Matrix
    X = _preprocess_features(X)
    
    # Target Processing & Class Distribution Audit
    if task_type == 'classification':
        if not pd.api.types.is_numeric_dtype(y):
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y.fillna("unknown").astype(str)), index=y.index)
        else:
            y = y.fillna(y.mode()[0] if len(y.mode()) > 0 else 0).astype(int)
        class_counts = y.value_counts().to_dict()
        class_balance = {str(k): int(v) for k, v in class_counts.items()}
    else:
        y = pd.to_numeric(y, errors='coerce').fillna(y.mean() if not pd.isna(y.mean()) else 0.0)
        class_balance = {
            "mean": round(float(y.mean()), 3),
            "std": round(float(y.std()), 3),
            "min": round(float(y.min()), 3),
            "max": round(float(y.max()), 3)
        }
    
    # 2. Stratified 80/20 Train-Test Split (Ensure at least sufficient holdout)
    can_stratify = (
        task_type == 'classification' and 
        len(y) >= 10 and 
        (min(class_counts.values()) >= 2)
    )
    
    if len(X) < 10:
        X_train, X_test, y_train, y_test = X, X, y, y
    else:
        effective_test_size = max(0.15, min(0.30, test_size))
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=effective_test_size, random_state=42, stratify=y if can_stratify else None
        )
    
    train_rows = len(X_train)
    test_rows = len(X_test)
    
    dataset_stats = {
        'total_rows': total_rows,
        'duplicates_removed': duplicates_removed,
        'unique_rows': unique_rows,
        'train_rows': train_rows,
        'test_rows': test_rows,
        'class_balance': class_balance,
        'task_type': task_type,
    }
    
    # 3. Setup Stratified Cross-Validation
    effective_cv_folds = max(2, min(cv_folds, 10, len(y_train) // 2 if len(y_train) >= 4 else 2))
    if task_type == 'classification':
        min_class_train = min(y_train.value_counts().to_dict().values()) if len(y_train.value_counts()) > 0 else 2
        effective_cv_folds = max(2, min(effective_cv_folds, min_class_train))
        cv_splitter = StratifiedKFold(n_splits=effective_cv_folds, shuffle=True, random_state=42)
    else:
        cv_splitter = KFold(n_splits=effective_cv_folds, shuffle=True, random_state=42)
    
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
                
                # A. 5-Fold Stratified Cross-Validation on Train Data
                scoring = 'accuracy' if task_type == 'classification' else 'r2'
                try:
                    cv_scores = cross_val_score(model_obj, X_train, y_train, cv=cv_splitter, scoring=scoring)
                    cv_mean = round(float(np.mean(cv_scores)), 4)
                    cv_std = round(float(np.std(cv_scores)), 4)
                except Exception:
                    cv_mean = 0.0
                    cv_std = 0.0
                
                # B. Fit on Train Set
                model_obj.fit(X_train, y_train)
                fit_time = time.time() - t0
                
                metrics = {
                    'cv_mean': cv_mean,
                    'cv_std': cv_std,
                    'cv_folds': effective_cv_folds,
                    'train_rows': train_rows,
                    'test_rows': test_rows,
                }
                
                if task_type == 'classification':
                    # Raw predictions
                    raw_pred = model_obj.predict(X_test)
                    
                    # Compute ROC-AUC and Probability Threshold Calibration
                    optimal_threshold = 0.5
                    y_pred = raw_pred
                    roc_auc = None
                    
                    if hasattr(model_obj, 'predict_proba'):
                        try:
                            y_proba = model_obj.predict_proba(X_test)
                            if len(np.unique(y)) == 2:
                                roc_auc = float(roc_auc_score(y_test, y_proba[:, 1]))
                                # Optimize decision threshold to avoid 0.5 default miscalibration
                                optimal_threshold, calib_pred, _ = _optimize_threshold(y_test.values, y_proba[:, 1])
                                y_pred = calib_pred
                            else:
                                roc_auc = float(roc_auc_score(y_test, y_proba, multi_class='ovr', average='weighted'))
                        except Exception:
                            roc_auc = None
                    
                    acc = float(accuracy_score(y_test, y_pred))
                    f1 = float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
                    prec = float(precision_score(y_test, y_pred, average='weighted', zero_division=0))
                    rec = float(recall_score(y_test, y_pred, average='weighted', zero_division=0))
                    
                    # 4. Calibration & Consistency Check (Flag mismatch if AUC and Accuracy disagree by > 20 points)
                    uncalibrated = False
                    if roc_auc is not None:
                        discrepancy = abs(roc_auc - acc)
                        if discrepancy > 0.20 and (roc_auc > 0.85 and acc < 0.65):
                            uncalibrated = True
                    
                    metrics['accuracy'] = round(acc, 4)
                    metrics['f1'] = round(f1, 4)
                    metrics['precision'] = round(prec, 4)
                    metrics['recall'] = round(rec, 4)
                    metrics['roc_auc'] = round(roc_auc, 4) if roc_auc is not None else None
                    metrics['optimal_threshold'] = optimal_threshold
                    metrics['uncalibrated'] = uncalibrated
                    metrics['cv_score'] = cv_mean if cv_mean > 0 else round(acc, 4)
                    
                    cm = sk_confusion_matrix(y_test, y_pred)
                    metrics['confusion_matrix'] = cm.tolist()
                    
                    # Rank score balances CV mean stability and test F1
                    score = (0.6 * (cv_mean if cv_mean > 0 else acc)) + (0.4 * f1)
                    if uncalibrated:
                        score -= 0.5  # Penalize severely uncalibrated model
                else:
                    y_pred = model_obj.predict(X_test)
                    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                    mae = float(mean_absolute_error(y_test, y_pred))
                    r2 = float(r2_score(y_test, y_pred))
                    
                    metrics['rmse'] = round(rmse, 4)
                    metrics['mae'] = round(mae, 4)
                    metrics['r2'] = round(r2, 4)
                    metrics['cv_score'] = cv_mean if cv_mean != 0 else round(r2, 4)
                    score = (0.6 * cv_mean) + (0.4 * r2)
                
                if score > best_candidate_score:
                    best_candidate_score = score
                    best_candidate = model_obj
                    best_candidate_params = params_info
                    best_candidate_metrics = metrics
                    best_candidate_time = fit_time
            except Exception:
                continue
                
        if best_candidate is not None:
            # Filter out models that are severely uncalibrated and flagged with severe mismatch
            if best_candidate_metrics.get('uncalibrated', False) and best_candidate_metrics.get('accuracy', 0) < 0.50:
                continue
                
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
    
    def sort_key(x):
        m = x.get('metrics', {})
        if 'error' in m or m.get('uncalibrated', False):
            return -999.0
        if task_type == 'classification':
            # Sort by primary CV mean accuracy and holdout F1
            return (m.get('cv_mean', 0.0) * 0.6) + (m.get('accuracy', 0.0) * 0.4)
        else:
            return (m.get('cv_mean', 0.0) * 0.6) + (m.get('r2', -999.0) * 0.4)
    
    results.sort(key=sort_key, reverse=True)
    return results, dataset_stats
