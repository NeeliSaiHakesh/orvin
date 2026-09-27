"""AutoML Training Engine for AutoMLOps.

Trains multiple ML models with strict statistical data-quality standards:
- Exact duplicate removal before splitting (preventing train/test leakage)
- Stratified 80/20 train-test holdout split with verification of holdout sample size
- 5-Fold Stratified Cross-Validation reporting mean accuracy ± standard deviation
- Out-of-fold probability threshold calibration on training set (zero test leakage)
- Automatic identifier and index column removal (preventing memorization leakage)
- Flagging and filtering of uncalibrated models (AUC vs Accuracy discrepancy > 20 points)
- Full dataset audit statistics (total rows, duplicates removed, unique rows, train/test counts, class balance)
"""
import pandas as pd  # type: ignore
import numpy as np  # type: ignore
import importlib.metadata
from sklearn.model_selection import train_test_split, StratifiedKFold, KFold, cross_val_score, cross_val_predict  # type: ignore
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder  # type: ignore
from sklearn.impute import SimpleImputer  # type: ignore
from sklearn.compose import ColumnTransformer  # type: ignore
from sklearn.pipeline import Pipeline  # type: ignore
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
from typing import Any
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


def _get_classification_candidates() -> dict[str, list[tuple[Any, dict[str, Any]]]]:
    """Get classification model variations configured for robust, calibrated learning."""
    models: dict[str, list[tuple[Any, dict[str, Any]]]] = {
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


def _get_regression_candidates() -> dict[str, list[tuple[Any, dict[str, Any]]]]:
    """Get regression model variations configured for robust learning."""
    models: dict[str, list[tuple[Any, dict[str, Any]]]] = {
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


def _detect_id_columns(X: pd.DataFrame) -> list[str]:
    """Detect likely ID or high-cardinality identifier columns to drop."""
    id_patterns = ['_id', 'id', 'uuid', 'guid', 'key', 'index']
    cols_to_drop = []
    for col in X.columns:
        c_lower = str(col).lower()
        if any(c_lower == p or c_lower.endswith(p) or c_lower.startswith(p + '_') for p in id_patterns):
            if X[col].nunique() > 0.8 * len(X) and len(X) > 20:
                cols_to_drop.append(col)
    return cols_to_drop


def _build_preprocessor(
    X: pd.DataFrame,
) -> tuple[pd.DataFrame, ColumnTransformer, dict]:
    """Build a fitted ColumnTransformer preprocessing pipeline and return transformed data + metadata.

    Returns:
        (X_transformed as DataFrame, fitted ColumnTransformer pipeline, preprocessing metadata dict)
    """
    X_clean = X.copy()

    # 1. Drop ID columns
    id_cols = _detect_id_columns(X_clean)
    if id_cols:
        X_clean = X_clean.drop(columns=id_cols)

    # 2. Detect datetime columns and extract temporal features inline
    #    (datetimes need to become numeric before the pipeline sees them)
    datetime_cols = X_clean.select_dtypes(include=['datetime64']).columns.tolist()
    for col in X_clean.select_dtypes(include=['object']).columns:
        try:
            pd.to_datetime(X_clean[col].dropna().head(20))
            X_clean[col] = pd.to_datetime(X_clean[col], errors='coerce')
            datetime_cols.append(col)
        except (ValueError, TypeError):
            pass

    datetime_derived = []
    for col in datetime_cols:
        if pd.api.types.is_datetime64_any_dtype(X_clean[col]):
            X_clean[f'{col}_year'] = X_clean[col].dt.year.fillna(0).astype(float)
            X_clean[f'{col}_month'] = X_clean[col].dt.month.fillna(0).astype(float)
            X_clean[f'{col}_day'] = X_clean[col].dt.day.fillna(0).astype(float)
            X_clean[f'{col}_dayofweek'] = X_clean[col].dt.dayofweek.fillna(0).astype(float)
            datetime_derived.extend([f'{col}_year', f'{col}_month', f'{col}_day', f'{col}_dayofweek'])
            X_clean = X_clean.drop(columns=[col])

    # 3. Classify remaining columns
    numeric_cols = X_clean.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = X_clean.select_dtypes(include=['object', 'category']).columns.tolist()

    # Coerce categoricals to string (required for OrdinalEncoder)
    for col in categorical_cols:
        X_clean[col] = X_clean[col].fillna('__missing__').astype(str)

    # 4. Build ColumnTransformer
    transformers = []
    if numeric_cols:
        numeric_pipeline = Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
        ])
        transformers.append(('numeric', numeric_pipeline, numeric_cols))

    # Record category maps before fitting
    category_maps: dict[str, list[str]] = {}
    if categorical_cols:
        # Pre-compute categories for each column so OrdinalEncoder knows them
        categories_list = []
        for col in categorical_cols:
            cats = sorted(X_clean[col].unique().tolist())
            if '__missing__' not in cats:
                cats.append('__missing__')
            categories_list.append(cats)
            category_maps[col] = cats

        categorical_pipeline = Pipeline([
            ('imputer', SimpleImputer(strategy='constant', fill_value='__missing__')),
            ('encoder', OrdinalEncoder(
                categories=categories_list,
                handle_unknown='use_encoded_value',
                unknown_value=-1,
                dtype=float,
            )),
        ])
        transformers.append(('categorical', categorical_pipeline, categorical_cols))

    if not transformers:
        # Edge case: no columns left (shouldn't happen in practice)
        transformers.append(('passthrough', 'passthrough', X_clean.columns.tolist()))

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder='drop',
        verbose_feature_names_out=False,
    )

    # 5. Fit and transform
    X_transformed = preprocessor.fit_transform(X_clean)

    # Build output column names
    output_columns = numeric_cols + categorical_cols  # ColumnTransformer ordering

    X_out = pd.DataFrame(X_transformed, columns=output_columns, index=X_clean.index)

    # 6. Collect metadata for the API generator
    column_dtypes = {col: str(X.dtypes.get(col, 'float64')) for col in X.columns}
    # Collect sample values for schema examples
    sample_values: dict[str, Any] = {}
    for col in X.columns:
        if col in numeric_cols and col in X_clean.columns:
            med = X_clean[col].median()
            sample_values[col] = round(float(med), 2) if not pd.isna(med) else 0.0
        elif col in categorical_cols and col in X_clean.columns:
            mode_vals = X_clean[col].mode()
            sample_values[col] = str(mode_vals.iloc[0]) if len(mode_vals) > 0 else category_maps.get(col, ['__missing__'])[0]
        elif col in datetime_cols:
            sample_values[col] = "2024-01-15"
        elif col in id_cols:
            sample_values[col] = str(X[col].iloc[0]) if len(X) > 0 else "ID_001"
        else:
            sample_values[col] = str(X[col].iloc[0]) if len(X) > 0 else 0.0

    metadata = {
        'input_columns': X.columns.tolist(),  # All raw features expected by the API
        'pipeline_columns': (numeric_cols + categorical_cols),  # Columns after ID/datetime extraction
        'numeric_columns': numeric_cols,
        'categorical_columns': categorical_cols,
        'category_maps': category_maps,
        'column_dtypes': column_dtypes,
        'dropped_id_columns': id_cols,
        'datetime_columns': datetime_cols,
        'datetime_derived_columns': datetime_derived,
        'output_columns': output_columns,
        'sample_values': sample_values,
    }

    return X_out, preprocessor, metadata


def _preprocess_features(X: pd.DataFrame) -> pd.DataFrame:
    """Legacy wrapper — ensures backward compat for any code calling this directly."""
    X_out, _, _ = _build_preprocessor(X)
    return X_out


def _optimize_threshold(y_true: np.ndarray, y_proba_pos: np.ndarray) -> tuple[float, np.ndarray, float]:
    """Find optimal decision threshold maximizing F1 score on training folds."""
    best_thresh = 0.5
    best_f1 = -1.0
    best_preds = (y_proba_pos >= 0.5).astype(int)
    
    thresholds = np.linspace(0.10, 0.90, 33)
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
    model_version: int = 1,
) -> tuple[list[dict], dict]:
    """Train multiple models with data-quality deduplication, stratified CV, and threshold calibration.
    
    Returns:
        tuple (results: list[dict], dataset_stats: dict)
    """
    # 1. Exact Deduplication Audit & Check (Prevent identical rows leaking across train/test)
    if raw_df is not None:
        total_rows = len(raw_df)
        duplicates_removed = int(raw_df.duplicated().sum())
        clean_df = raw_df.drop_duplicates().reset_index(drop=True)
        unique_rows = len(clean_df)
        
        target_name = y.name if (hasattr(y, 'name') and y.name and y.name in clean_df.columns) else clean_df.columns[-1]
        X = clean_df.drop(columns=[target_name])
        y = clean_df[target_name]
    else:
        full_df = pd.concat([X, y.rename('__target__')], axis=1)
        total_rows = len(full_df)
        duplicates_removed = int(full_df.duplicated().sum())
        clean_df = full_df.drop_duplicates().reset_index(drop=True)
        unique_rows = len(clean_df)
        X = clean_df.drop(columns=['__target__'])
        y = clean_df['__target__']

    # Preprocess Feature Matrix — build fitted pipeline + metadata
    X, fitted_preprocessor, preprocessing_metadata = _build_preprocessor(X)
    
    # Target Processing & Class Distribution Audit
    class_counts: dict[Any, int] = {}
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
    
    # 2. Stratified 80/20 Train-Test Split (Ensure clean out-of-sample holdout)
    can_stratify = (
        task_type == 'classification' and 
        len(y) >= 10 and 
        bool(class_counts) and
        (min(class_counts.values()) >= 2)
    )
    
    # Always do a proper train-test split — never use the same data for both.
    # For very small datasets, use a larger test fraction to get at least a few test samples,
    # but never reuse training data as test data (that guarantees 100% and is data leakage).
    if len(X) < 5:
        # Absolute minimum: need at least 5 rows to do any meaningful ML
        # Use leave-one-out style: 1 test sample, rest for train
        effective_test_size = max(1 / len(X), 0.2)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=effective_test_size, random_state=42
        )
    else:
        effective_test_size = max(0.15, min(0.30, test_size))
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=effective_test_size, random_state=42, stratify=y if can_stratify else None
        )
    
    train_rows = len(X_train)
    test_rows = len(X_test)
    
    # Flag when test set is too small for statistically meaningful evaluation
    small_dataset_warning = test_rows < 20
    
    dataset_stats = {
        'total_rows': total_rows,
        'duplicates_removed': duplicates_removed,
        'unique_rows': unique_rows,
        'train_rows': train_rows,
        'test_rows': test_rows,
        'class_balance': class_balance,
        'task_type': task_type,
        'small_dataset_warning': small_dataset_warning,
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
                
                # B. Threshold Tuning strictly on TRAIN fold out-of-fold probabilities (Zero test leakage)
                optimal_threshold = 0.5
                if task_type == 'classification' and hasattr(model_obj, 'predict_proba') and len(np.unique(y_train)) == 2:
                    try:
                        train_oof_proba = cross_val_predict(model_obj, X_train, y_train, cv=cv_splitter, method='predict_proba')[:, 1]
                        optimal_threshold, _, _ = _optimize_threshold(y_train.values, train_oof_proba)
                    except Exception:
                        optimal_threshold = 0.5
                
                # C. Fit final candidate on Train Set
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
                    # Apply learned threshold to holdout Test Set
                    roc_auc = None
                    if hasattr(model_obj, 'predict_proba'):
                        try:
                            y_proba = model_obj.predict_proba(X_test)
                            if len(np.unique(y_test)) == 2:
                                roc_auc = float(roc_auc_score(y_test, y_proba[:, 1]))
                                y_pred = (y_proba[:, 1] >= optimal_threshold).astype(int)
                            else:
                                roc_auc = float(roc_auc_score(y_test, y_proba, multi_class='ovr', average='weighted'))
                                y_pred = model_obj.predict(X_test)
                        except Exception:
                            y_pred = model_obj.predict(X_test)
                    else:
                        y_pred = model_obj.predict(X_test)
                    
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
                
            model_filename = f"{project_id}_v{model_version}_{algo_name}.joblib"
            model_path = os.path.join(settings.MODEL_REGISTRY_DIR, model_filename)
            joblib.dump(best_candidate, model_path)

            # Persist the fitted preprocessor alongside the model
            preprocessor_filename = f"{project_id}_v{model_version}_{algo_name}_preprocessor.joblib"
            preprocessor_path = os.path.join(settings.MODEL_REGISTRY_DIR, preprocessor_filename)
            joblib.dump({
                'pipeline': fitted_preprocessor,
                'metadata': preprocessing_metadata,
            }, preprocessor_path)

            # Determine the model's library and pinned version for requirements.txt generation
            model_lib = 'scikit-learn'
            mod_module = type(best_candidate).__module__.lower()
            if 'catboost' in mod_module:
                model_lib = 'catboost'
            elif 'xgboost' in mod_module:
                model_lib = 'xgboost'
            elif 'lightgbm' in mod_module:
                model_lib = 'lightgbm'

            model_lib_version = None
            try:
                model_lib_version = importlib.metadata.version(model_lib)
            except Exception:
                pass

            test_data_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{project_id}_v{model_version}_{algo_name}_test_data.joblib")
            joblib.dump({'X_test': X_test, 'y_test': y_test, 'feature_names': X.columns.tolist()}, test_data_path)
            
            results.append({
                'algorithm': algo_name,
                'version': model_version,
                'hyperparameters': best_candidate_params,
                'metrics': best_candidate_metrics,
                'model_path': model_path,
                'preprocessor_path': preprocessor_path,
                'model_library': model_lib,
                'model_library_version': model_lib_version,
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
