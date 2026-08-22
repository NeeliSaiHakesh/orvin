"""Dataset Analysis Engine for AutoMLOps.

Provides comprehensive automated dataset profiling including
type detection, statistics, missing values, outliers, correlations,
class balance, and distribution analysis.
"""
import pandas as pd
import numpy as np
from typing import Any


def load_dataset(file_path: str, file_type: str) -> pd.DataFrame:
    """Load dataset from file based on type."""
    loaders = {
        'csv': pd.read_csv,
        'excel': pd.read_excel,
        'json': pd.read_json,
    }
    loader = loaders.get(file_type)
    if not loader:
        raise ValueError(f"Unsupported file type: {file_type}")
    return loader(file_path)


def detect_column_types(df: pd.DataFrame) -> dict[str, str]:
    """Detect semantic data types for each column."""
    type_map = {}
    for col in df.columns:
        dtype = df[col].dtype
        nunique = df[col].nunique()
        n = len(df)
        
        if pd.api.types.is_bool_dtype(dtype):
            type_map[col] = 'boolean'
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            type_map[col] = 'datetime'
        elif pd.api.types.is_numeric_dtype(dtype):
            # Check if it's actually categorical (few unique integers)
            if pd.api.types.is_integer_dtype(dtype) and nunique <= 20 and nunique / n < 0.05:
                type_map[col] = 'categorical'
            else:
                type_map[col] = 'numeric'
        elif pd.api.types.is_string_dtype(dtype) or dtype == object:
            # Try to parse as datetime
            try:
                pd.to_datetime(df[col].dropna().head(100))
                type_map[col] = 'datetime'
            except (ValueError, TypeError):
                if nunique / n < 0.5 and nunique <= 50:
                    type_map[col] = 'categorical'
                elif df[col].str.len().mean() > 50:
                    type_map[col] = 'text'
                else:
                    type_map[col] = 'categorical'
        else:
            type_map[col] = str(dtype)
    return type_map


def compute_statistics(df: pd.DataFrame) -> dict[str, dict]:
    """Compute detailed statistics for numeric columns."""
    stats = {}
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        col_data = df[col].dropna()
        if col_data.empty:
            continue
        stats[col] = {
            'count': int(col_data.count()),
            'mean': round(float(col_data.mean()), 4),
            'median': round(float(col_data.median()), 4),
            'std': round(float(col_data.std()), 4),
            'min': round(float(col_data.min()), 4),
            'max': round(float(col_data.max()), 4),
            'q1': round(float(col_data.quantile(0.25)), 4),
            'q3': round(float(col_data.quantile(0.75)), 4),
            'iqr': round(float(col_data.quantile(0.75) - col_data.quantile(0.25)), 4),
            'skewness': round(float(col_data.skew()), 4),
            'kurtosis': round(float(col_data.kurtosis()), 4),
            'variance': round(float(col_data.var()), 4),
            'zeros': int((col_data == 0).sum()),
            'negatives': int((col_data < 0).sum()),
        }
    
    # Categorical column stats
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        col_data = df[col].dropna()
        if col_data.empty:
            continue
        value_counts = col_data.value_counts()
        stats[col] = {
            'count': int(col_data.count()),
            'unique': int(col_data.nunique()),
            'top': str(value_counts.index[0]) if len(value_counts) > 0 else None,
            'top_freq': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            'top_5': {str(k): int(v) for k, v in value_counts.head(5).items()},
        }
    return stats


def compute_missing_values(df: pd.DataFrame) -> dict[str, dict]:
    """Analyze missing values per column."""
    total = len(df)
    missing = {}
    for col in df.columns:
        null_count = int(df[col].isnull().sum())
        missing[col] = {
            'count': null_count,
            'percentage': round(null_count / total * 100, 2) if total > 0 else 0,
            'dtype': str(df[col].dtype),
        }
    # Overall stats
    total_missing = sum(v['count'] for v in missing.values())
    total_cells = total * len(df.columns)
    missing['__summary__'] = {
        'total_missing_cells': total_missing,
        'total_cells': total_cells,
        'overall_percentage': round(total_missing / total_cells * 100, 2) if total_cells > 0 else 0,
        'complete_rows': int((~df.isnull().any(axis=1)).sum()),
        'rows_with_missing': int(df.isnull().any(axis=1).sum()),
    }
    return missing


def detect_duplicates(df: pd.DataFrame) -> dict:
    """Detect duplicate rows."""
    dup_count = int(df.duplicated().sum())
    return {
        'total_duplicates': dup_count,
        'percentage': round(dup_count / len(df) * 100, 2) if len(df) > 0 else 0,
        'unique_rows': int(len(df) - dup_count),
    }


def detect_outliers(df: pd.DataFrame) -> dict[str, dict]:
    """Detect outliers using IQR and Z-score methods."""
    outliers = {}
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        col_data = df[col].dropna()
        if col_data.empty or len(col_data) < 4:
            continue
        # IQR method
        q1 = col_data.quantile(0.25)
        q3 = col_data.quantile(0.75)
        iqr = q3 - q1
        iqr_lower = q1 - 1.5 * iqr
        iqr_upper = q3 + 1.5 * iqr
        iqr_outliers = int(((col_data < iqr_lower) | (col_data > iqr_upper)).sum())
        
        # Z-score method
        mean = col_data.mean()
        std = col_data.std()
        if std > 0:
            z_scores = np.abs((col_data - mean) / std)
            z_outliers = int((z_scores > 3).sum())
        else:
            z_outliers = 0
        
        outliers[col] = {
            'iqr_outliers': iqr_outliers,
            'z_score_outliers': z_outliers,
            'iqr_bounds': {'lower': round(float(iqr_lower), 4), 'upper': round(float(iqr_upper), 4)},
            'percentage': round(iqr_outliers / len(col_data) * 100, 2) if len(col_data) > 0 else 0,
        }
    return outliers


def compute_correlations(df: pd.DataFrame) -> dict:
    """Compute correlation matrix for numeric columns."""
    num_cols = df.select_dtypes(include=[np.number]).columns
    if len(num_cols) < 2:
        return {'matrix': {}, 'high_correlations': []}
    
    corr = df[num_cols].corr()
    
    # Find highly correlated pairs
    high_corr = []
    for i in range(len(corr.columns)):
        for j in range(i + 1, len(corr.columns)):
            val = corr.iloc[i, j]
            if abs(val) > 0.7:
                high_corr.append({
                    'feature_1': corr.columns[i],
                    'feature_2': corr.columns[j],
                    'correlation': round(float(val), 4),
                })
    
    high_corr.sort(key=lambda x: abs(x['correlation']), reverse=True)
    
    return {
        'matrix': {col: {c: round(float(v), 4) for c, v in row.items()} 
                   for col, row in corr.replace({np.nan: 0}).to_dict().items()},
        'high_correlations': high_corr,
    }


def compute_class_balance(df: pd.DataFrame, target_column: str = None) -> dict:
    """Analyze class balance for a target column."""
    if target_column and target_column in df.columns:
        value_counts = df[target_column].value_counts()
        total = len(df)
        balance = {}
        for val, count in value_counts.items():
            balance[str(val)] = {
                'count': int(count),
                'percentage': round(count / total * 100, 2),
            }
        # Imbalance ratio
        if len(value_counts) >= 2:
            max_count = value_counts.max()
            min_count = value_counts.min()
            imbalance_ratio = round(max_count / min_count, 2) if min_count > 0 else float('inf')
        else:
            imbalance_ratio = 1.0
        return {
            'classes': balance,
            'num_classes': len(value_counts),
            'imbalance_ratio': imbalance_ratio,
            'is_imbalanced': imbalance_ratio > 3.0,
        }
    return {}


def compute_distributions(df: pd.DataFrame) -> dict[str, dict]:
    """Compute distribution data for visualization."""
    distributions = {}
    
    # Numeric columns - histograms
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        col_data = df[col].dropna()
        if col_data.empty:
            continue
        counts, bin_edges = np.histogram(col_data, bins=min(30, max(10, int(np.sqrt(len(col_data))))))            
        distributions[col] = {
            'type': 'histogram',
            'counts': counts.tolist(),
            'bin_edges': [round(float(b), 4) for b in bin_edges.tolist()],
        }
    
    # Categorical columns - value counts
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        value_counts = df[col].value_counts().head(20)
        distributions[col] = {
            'type': 'bar',
            'labels': [str(k) for k in value_counts.index.tolist()],
            'values': value_counts.values.tolist(),
        }
    return distributions


def analyze_dataset(file_path: str, file_type: str, target_column: str = None) -> dict:
    """Run complete dataset analysis and return comprehensive report."""
    df = load_dataset(file_path, file_type)
    
    return {
        'row_count': len(df),
        'column_count': len(df.columns),
        'columns': df.columns.tolist(),
        'memory_usage_mb': round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2),
        'data_types': detect_column_types(df),
        'statistics': compute_statistics(df),
        'missing_values': compute_missing_values(df),
        'duplicates': detect_duplicates(df),
        'outliers': detect_outliers(df),
        'correlations': compute_correlations(df),
        'class_balance': compute_class_balance(df, target_column),
        'distributions': compute_distributions(df),
    }
