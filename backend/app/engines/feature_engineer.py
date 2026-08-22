"""Automated Feature Engineering Engine for AutoMLOps.

Performs intelligent feature selection, encoding, scaling,
datetime extraction, and generates AI explanations for
each transformation applied.
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder, OneHotEncoder
from sklearn.feature_selection import VarianceThreshold, mutual_info_classif, mutual_info_regression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from typing import Any


def engineer_features(
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
) -> tuple[pd.DataFrame, dict]:
    """Run automated feature engineering pipeline.
    
    Args:
        df: Input DataFrame (should be cleaned)
        target_column: Name of target column
        task_type: 'classification' or 'regression'
    
    Returns:
        Tuple of (engineered DataFrame, feature info dict)
    """
    df = df.copy()
    feature_info = {
        'transformations': [],
        'feature_importance': {},
        'original_columns': df.columns.tolist(),
        'original_shape': list(df.shape),
    }
    
    # Separate target
    if not target_column or target_column not in df.columns:
        target_column = df.columns[-1]
    y = df[target_column]
    X = df.drop(columns=[target_column])
    
    # ── Step 1: DateTime Feature Extraction ──
    datetime_cols = X.select_dtypes(include=['datetime64']).columns.tolist()
    # Also try to detect string datetimes
    for col in X.select_dtypes(include=['object']).columns:
        try:
            pd.to_datetime(X[col].dropna().head(20))
            X[col] = pd.to_datetime(X[col], errors='coerce')
            datetime_cols.append(col)
        except (ValueError, TypeError):
            pass
    
    for col in datetime_cols:
        if pd.api.types.is_datetime64_any_dtype(X[col]):
            X[f'{col}_year'] = X[col].dt.year
            X[f'{col}_month'] = X[col].dt.month
            X[f'{col}_day'] = X[col].dt.day
            X[f'{col}_dayofweek'] = X[col].dt.dayofweek
            X[f'{col}_hour'] = X[col].dt.hour.fillna(0).astype(int)
            X[f'{col}_is_weekend'] = (X[col].dt.dayofweek >= 5).astype(int)
            X = X.drop(columns=[col])
            feature_info['transformations'].append({
                'type': 'datetime_extraction',
                'column': col,
                'new_features': [f'{col}_year', f'{col}_month', f'{col}_day',
                                 f'{col}_dayofweek', f'{col}_hour', f'{col}_is_weekend'],
                'explanation': f'Extracted temporal components from "{col}" to capture seasonal patterns, day-of-week effects, and time-of-day variations.',
            })
    
    # ── Step 2: Encode Categorical Variables ──
    cat_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
    for col in cat_cols:
        nunique = X[col].nunique()
        if nunique <= 10:
            # One-hot encoding for low cardinality
            dummies = pd.get_dummies(X[col], prefix=col, drop_first=True, dtype=int)
            X = pd.concat([X.drop(columns=[col]), dummies], axis=1)
            feature_info['transformations'].append({
                'type': 'one_hot_encoding',
                'column': col,
                'num_classes': nunique,
                'explanation': f'One-hot encoded "{col}" ({nunique} unique values). Used one-hot because cardinality is low enough to avoid dimensionality explosion.',
            })
        else:
            # Label encoding for high cardinality
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            feature_info['transformations'].append({
                'type': 'label_encoding',
                'column': col,
                'num_classes': nunique,
                'explanation': f'Label encoded "{col}" ({nunique} unique values). Used label encoding because one-hot would create too many features.',
            })
    
    # ── Step 3: Handle remaining non-numeric columns ──
    remaining_obj = X.select_dtypes(include=['object']).columns.tolist()
    if remaining_obj:
        X = X.drop(columns=remaining_obj)
        feature_info['transformations'].append({
            'type': 'drop_non_numeric',
            'columns': remaining_obj,
            'explanation': f'Dropped {len(remaining_obj)} non-numeric columns that could not be encoded.',
        })
    
    # Fill any remaining NaN
    X = X.fillna(0)
    
    # ── Step 4: Remove Low-Variance Features ──
    try:
        num_cols_before = X.shape[1]
        selector = VarianceThreshold(threshold=0.01)
        X_selected = selector.fit_transform(X)
        selected_mask = selector.get_support()
        removed = [X.columns[i] for i in range(len(selected_mask)) if not selected_mask[i]]
        X = X.loc[:, selected_mask]
        if removed:
            feature_info['transformations'].append({
                'type': 'variance_threshold',
                'removed_features': removed,
                'threshold': 0.01,
                'explanation': f'Removed {len(removed)} near-constant features (variance < 0.01) as they provide no discriminative information.',
            })
    except Exception:
        pass
    
    # ── Step 5: Scaling ──
    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    if num_cols:
        scaler = StandardScaler()
        X[num_cols] = scaler.fit_transform(X[num_cols])
        feature_info['transformations'].append({
            'type': 'standard_scaling',
            'columns_count': len(num_cols),
            'explanation': 'Applied StandardScaler to all numeric features. This ensures features are on the same scale, which is critical for distance-based models (SVM, KNN) and regularized models (Ridge, Lasso).',
        })
    
    # ── Step 6: Feature Importance ──
    try:
        if task_type == 'classification':
            rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
        else:
            rf = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        
        # Encode target if needed
        y_encoded = y
        if not pd.api.types.is_numeric_dtype(y):
            y_encoded = LabelEncoder().fit_transform(y)
        
        rf.fit(X, y_encoded)
        importances = rf.feature_importances_
        importance_dict = {}
        for fname, imp in sorted(zip(X.columns, importances), key=lambda x: x[1], reverse=True):
            importance_dict[fname] = round(float(imp), 6)
        
        feature_info['feature_importance'] = importance_dict
    except Exception as e:
        feature_info['feature_importance_error'] = str(e)
    
    # ── Step 7: Feature Selection using Mutual Information ──
    try:
        y_encoded = y if pd.api.types.is_numeric_dtype(y) else LabelEncoder().fit_transform(y)
        
        if task_type == 'classification':
            mi_scores = mutual_info_classif(X, y_encoded, random_state=42)
        else:
            mi_scores = mutual_info_regression(X, y_encoded, random_state=42)
        
        mi_dict = dict(zip(X.columns, mi_scores))
        feature_info['mutual_information'] = {
            k: round(float(v), 6)
            for k, v in sorted(mi_dict.items(), key=lambda x: x[1], reverse=True)
        }
    except Exception:
        pass
    
    # Reconstruct DataFrame with target
    result_df = pd.concat([X, y.reset_index(drop=True)], axis=1)
    feature_info['final_shape'] = list(result_df.shape)
    feature_info['final_columns'] = result_df.columns.tolist()
    feature_info['num_features'] = X.shape[1]
    
    return result_df, feature_info
