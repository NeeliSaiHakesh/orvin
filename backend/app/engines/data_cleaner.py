"""AI Data Cleaning Engine for AutoMLOps.

Automates dataset cleaning with intelligent defaults:
missing value imputation, duplicate removal, outlier handling,
type conversion, normalization, categorical encoding, and
high-correlation feature removal.
"""
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from typing import Any


def suggest_cleaning(df: pd.DataFrame, analysis_report: dict) -> list[dict]:
    """Generate AI-powered cleaning suggestions based on analysis report."""
    suggestions = []
    
    # 1. Missing value suggestions
    missing = analysis_report.get('missing_values', {})
    cols_with_missing = [
        col for col, info in missing.items()
        if col != '__summary__' and isinstance(info, dict) and info.get('count', 0) > 0
    ]
    if cols_with_missing:
        high_missing = [c for c in cols_with_missing if missing[c]['percentage'] > 50]
        low_missing = [c for c in cols_with_missing if missing[c]['percentage'] <= 50]
        
        if high_missing:
            suggestions.append({
                'step_name': 'Drop High-Missing Columns',
                'description': f'Columns with >50% missing values should be dropped: {", ".join(high_missing)}',
                'affected_columns': high_missing,
                'impact': f'Removes {len(high_missing)} unreliable columns',
                'priority': 'high',
            })
        if low_missing:
            suggestions.append({
                'step_name': 'Fill Missing Values',
                'description': 'Fill missing values using mean for numeric columns and mode for categorical columns.',
                'affected_columns': low_missing,
                'impact': f'Resolves missing data in {len(low_missing)} columns',
                'priority': 'high',
            })
    
    # 2. Duplicate suggestions
    duplicates = analysis_report.get('duplicates', {})
    if duplicates.get('total_duplicates', 0) > 0:
        suggestions.append({
            'step_name': 'Remove Duplicates',
            'description': f'Found {duplicates["total_duplicates"]} duplicate rows ({duplicates["percentage"]}% of data).',
            'affected_columns': ['all'],
            'impact': f'Removes {duplicates["total_duplicates"]} redundant rows',
            'priority': 'medium',
        })
    
    # 3. Outlier suggestions
    outliers = analysis_report.get('outliers', {})
    cols_with_outliers = [
        col for col, info in outliers.items()
        if isinstance(info, dict) and info.get('iqr_outliers', 0) > 0
    ]
    if cols_with_outliers:
        total_outliers = sum(outliers[c]['iqr_outliers'] for c in cols_with_outliers)
        suggestions.append({
            'step_name': 'Handle Outliers',
            'description': f'Cap outliers using IQR method in {len(cols_with_outliers)} columns ({total_outliers} total outlier values).',
            'affected_columns': cols_with_outliers,
            'impact': f'Normalizes extreme values in {len(cols_with_outliers)} columns',
            'priority': 'medium',
        })
    
    # 4. High correlation suggestions
    correlations = analysis_report.get('correlations', {})
    high_corr = correlations.get('high_correlations', [])
    very_high = [c for c in high_corr if abs(c['correlation']) > 0.95]
    if very_high:
        drop_cols = list(set(c['feature_2'] for c in very_high))
        suggestions.append({
            'step_name': 'Remove Highly Correlated Features',
            'description': f'Found {len(very_high)} feature pairs with correlation > 0.95. Suggest dropping: {", ".join(drop_cols)}.',
            'affected_columns': drop_cols,
            'impact': 'Reduces multicollinearity and model overfitting',
            'priority': 'low',
        })
    
    # 5. Type conversion suggestions
    data_types = analysis_report.get('data_types', {})
    potential_conversions = []
    for col, dtype in data_types.items():
        if dtype == 'datetime' and col in df.columns and not pd.api.types.is_datetime64_any_dtype(df[col]):
            potential_conversions.append(col)
    if potential_conversions:
        suggestions.append({
            'step_name': 'Convert Data Types',
            'description': f'Convert columns to proper types: {", ".join(potential_conversions)}.',
            'affected_columns': potential_conversions,
            'impact': 'Enables proper datetime feature extraction',
            'priority': 'low',
        })
    
    # 6. Categorical encoding
    cat_cols = [col for col, dtype in data_types.items() if dtype == 'categorical']
    if cat_cols:
        suggestions.append({
            'step_name': 'Encode Categorical Variables',
            'description': f'Encode {len(cat_cols)} categorical columns. One-hot for low cardinality, label encoding for high cardinality.',
            'affected_columns': cat_cols,
            'impact': 'Converts categorical data to numeric for ML models',
            'priority': 'medium',
        })
    
    # 7. Normalization
    num_cols = [col for col, dtype in data_types.items() if dtype == 'numeric']
    if num_cols:
        suggestions.append({
            'step_name': 'Normalize Numeric Features',
            'description': 'Apply StandardScaler normalization to numeric features.',
            'affected_columns': num_cols,
            'impact': 'Ensures all features are on the same scale for distance-based algorithms',
            'priority': 'low',
        })
    
    # Sort by priority
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    suggestions.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 2))
    
    return suggestions


def clean_dataset(df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, list[dict]]:
    """Apply cleaning operations to a dataset based on configuration.
    
    Config keys:
        fill_missing (bool): Fill missing values
        remove_duplicates (bool): Remove duplicate rows
        handle_outliers (bool): Cap outliers using IQR
        convert_types (bool): Auto-convert data types
        normalize (bool): Apply StandardScaler normalization
        encode_categorical (bool): Encode categorical columns
        remove_correlated (bool): Remove highly correlated features (>0.95)
        drop_high_missing (bool): Drop columns with >50% missing values
    """
    df = df.copy()
    steps_applied = []

    if hasattr(config, 'model_dump'):
        config = config.model_dump()
    elif hasattr(config, 'dict'):
        config = config.dict()
    elif not isinstance(config, dict):
        config = dict(config)

    # Step 1: Drop columns with >50% missing values
    if config.get('drop_high_missing', False):
        threshold = 0.5
        missing_pct = df.isnull().sum() / len(df)
        cols_to_drop = missing_pct[missing_pct > threshold].index.tolist()
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)
            steps_applied.append({
                'name': 'Drop High-Missing Columns',
                'details': f'Dropped {len(cols_to_drop)} columns with >50% missing: {", ".join(cols_to_drop)}',
                'columns_affected': len(cols_to_drop),
            })
    
    # Step 2: Fill missing values
    if config.get('fill_missing', False):
        filled_cols = []
        num_cols = df.select_dtypes(include=[np.number]).columns
        cat_cols = df.select_dtypes(include=['object', 'category']).columns
        bool_cols = df.select_dtypes(include=['bool']).columns
        
        for col in num_cols:
            if df[col].isnull().sum() > 0:
                median_val = df[col].median()
                df[col] = df[col].fillna(median_val)
                filled_cols.append(f"{col} (median={median_val:.2f})")
        
        for col in cat_cols:
            if df[col].isnull().sum() > 0:
                mode_val = df[col].mode()
                fill_val = mode_val.iloc[0] if not mode_val.empty else 'Unknown'
                df[col] = df[col].fillna(fill_val)
                filled_cols.append(f"{col} (mode={fill_val})")
        
        for col in bool_cols:
            if df[col].isnull().sum() > 0:
                df[col] = df[col].fillna(False)
                filled_cols.append(f"{col} (False)")
        
        if filled_cols:
            steps_applied.append({
                'name': 'Fill Missing Values',
                'details': f'Filled {len(filled_cols)} columns: {", ".join(filled_cols[:10])}',
                'columns_affected': len(filled_cols),
            })
    
    # Step 3: Remove duplicates
    if config.get('remove_duplicates', False):
        initial_rows = len(df)
        df = df.drop_duplicates()
        removed = initial_rows - len(df)
        if removed > 0:
            steps_applied.append({
                'name': 'Remove Duplicates',
                'details': f'Removed {removed} duplicate rows ({removed/initial_rows*100:.1f}%)',
                'rows_removed': removed,
            })
    
    # Step 4: Handle outliers (IQR capping)
    if config.get('handle_outliers', False):
        capped_cols = []
        num_cols = df.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_mask = (df[col] < lower) | (df[col] > upper)
            if outlier_mask.sum() > 0:
                df[col] = np.clip(df[col], lower, upper)
                capped_cols.append(f"{col} ({int(outlier_mask.sum())} values)")
        
        if capped_cols:
            steps_applied.append({
                'name': 'Handle Outliers (IQR Capping)',
                'details': f'Capped outliers in {len(capped_cols)} columns: {", ".join(capped_cols[:10])}',
                'columns_affected': len(capped_cols),
            })
    
    # Step 5: Convert data types
    if config.get('convert_types', False):
        converted = []
        for col in df.select_dtypes(include=['object']).columns:
            # Try numeric conversion
            try:
                df[col] = pd.to_numeric(df[col])
                converted.append(f"{col} -> numeric")
                continue
            except (ValueError, TypeError):
                pass
            # Try datetime conversion
            try:
                df[col] = pd.to_datetime(df[col])
                converted.append(f"{col} -> datetime")
            except (ValueError, TypeError):
                pass
        if converted:
            steps_applied.append({
                'name': 'Convert Data Types',
                'details': f'Converted {len(converted)} columns: {", ".join(converted)}',
                'columns_affected': len(converted),
            })
    
    # Step 6: Remove highly correlated features
    if config.get('remove_correlated', False):
        num_cols = df.select_dtypes(include=[np.number]).columns
        if len(num_cols) >= 2:
            corr_matrix = df[num_cols].corr().abs()
            upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            to_drop = [col for col in upper.columns if any(upper[col] > 0.95)]
            if to_drop:
                df = df.drop(columns=to_drop)
                steps_applied.append({
                    'name': 'Remove Highly Correlated Features',
                    'details': f'Dropped {len(to_drop)} features with correlation > 0.95: {", ".join(to_drop)}',
                    'columns_affected': len(to_drop),
                })
    
    # Step 7: Encode categorical variables
    if config.get('encode_categorical', False):
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        encoded_cols = []
        for col in cat_cols:
            nunique = df[col].nunique()
            if nunique <= 10:
                # One-hot encode
                dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
                df = pd.concat([df.drop(columns=[col]), dummies], axis=1)
                encoded_cols.append(f"{col} (one-hot, {nunique} classes)")
            else:
                # Label encode
                le = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                encoded_cols.append(f"{col} (label, {nunique} classes)")
        
        if encoded_cols:
            steps_applied.append({
                'name': 'Encode Categorical Variables',
                'details': f'Encoded {len(encoded_cols)} columns: {", ".join(encoded_cols[:10])}',
                'columns_affected': len(encoded_cols),
            })
    
    # Step 8: Normalize numeric features
    if config.get('normalize', False):
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if num_cols:
            scaler = StandardScaler()
            df[num_cols] = scaler.fit_transform(df[num_cols])
            steps_applied.append({
                'name': 'Normalize (StandardScaler)',
                'details': f'Applied StandardScaler to {len(num_cols)} numeric columns',
                'columns_affected': len(num_cols),
            })
    
    return df, steps_applied
