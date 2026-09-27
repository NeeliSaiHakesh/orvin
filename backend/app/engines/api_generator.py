"""Inference API Generator for AutoMLOps.

Generates a complete, production-ready FastAPI inference service that ships
the real fitted preprocessing pipeline alongside the model. No inline
encoding or type-coercion logic — the generated service calls
preprocessor.transform() then model.predict().
"""
import os
import sys
import zipfile
import json
import shutil
import logging
import importlib.metadata
from typing import Any
from app.config import settings

logger = logging.getLogger(__name__)


def _get_library_version(lib_name: str) -> str | None:
    """Get the installed version of a library, or None."""
    try:
        return importlib.metadata.version(lib_name)
    except Exception:
        return None


def resolve_artifact_path(path: str | None) -> str | None:
    """Resolve a model or preprocessor path that may be relative to backend or root."""
    if not path:
        return None
    if os.path.exists(path):
        return os.path.abspath(path)
    base_name = os.path.basename(path)
    cand1 = os.path.join(settings.MODEL_REGISTRY_DIR, base_name)
    if os.path.exists(cand1):
        return os.path.abspath(cand1)
    cand2 = os.path.join(os.path.dirname(settings.MODEL_REGISTRY_DIR), 'model_registry', base_name)
    if os.path.exists(cand2):
        return os.path.abspath(cand2)
    cand3 = os.path.join(os.path.dirname(os.path.dirname(settings.MODEL_REGISTRY_DIR)), 'model_registry', base_name)
    if os.path.exists(cand3):
        return os.path.abspath(cand3)
    return path


def _detect_model_library(model_path: str) -> tuple[str, str | None]:
    """Introspect a .joblib model to find its library and version."""
    import joblib
    resolved_mp = resolve_artifact_path(model_path)
    if resolved_mp and os.path.exists(resolved_mp):
        try:
            model = joblib.load(resolved_mp)
            mod_module = type(model).__module__.lower()
            if 'catboost' in mod_module:
                return 'catboost', _get_library_version('catboost')
            elif 'xgboost' in mod_module:
                return 'xgboost', _get_library_version('xgboost')
            elif 'lightgbm' in mod_module:
                return 'lightgbm', _get_library_version('lightgbm')
        except Exception:
            pass
    return 'scikit-learn', _get_library_version('scikit-learn')


def _detect_task_type(model_obj: Any, fallback: str = 'classification') -> str:
    """Introspect model object to determine if it is classification or regression."""
    if model_obj is None:
        return fallback
    
    class_name = type(model_obj).__name__.lower()
    
    # 1. Direct class name inspection
    if any(k in class_name for k in ('classifier', 'logistic', 'svc', 'decisiontreeclassifier', 'randomforestclassifier', 'catboostclassifier', 'lgbmclassifier', 'xgbclassifier')):
        return 'classification'
    if any(k in class_name for k in ('regressor', 'ridge', 'lasso', 'svr', 'linearregression', 'decisiontreeregressor', 'randomforestregressor', 'catboostregressor', 'lgbmregressor', 'xgbregressor')):
        return 'regression'
        
    # 2. Check for predict_proba (classifiers implement predict_proba)
    if hasattr(model_obj, 'predict_proba') and callable(getattr(model_obj, 'predict_proba')):
        return 'classification'
        
    # 3. Check classes_ attribute
    if hasattr(model_obj, 'classes_') and getattr(model_obj, 'classes_') is not None:
        return 'classification'
        
    return fallback


def _generate_schemas_code(metadata: dict, task_type: str) -> str:
    """Generate schemas.py source code with field types derived strictly from recorded metadata."""
    input_columns = metadata.get('input_columns', [])
    numeric_cols = set(metadata.get('numeric_columns', []))
    categorical_cols = set(metadata.get('categorical_columns', []))
    category_maps = metadata.get('category_maps', {})
    column_dtypes = metadata.get('column_dtypes', {})
    sample_values = metadata.get('sample_values', {})
    datetime_cols = set(metadata.get('datetime_columns', []))
    id_cols = set(metadata.get('dropped_id_columns', []))

    lines = [
        '"""Request and response schemas for the prediction API."""',
        'from pydantic import BaseModel, Field',
        'from typing import Optional',
    ]

    # Collect all Literal imports needed
    has_literals = any(col in category_maps and len(category_maps[col]) > 0 for col in categorical_cols)
    if has_literals:
        lines.append('from typing import Literal')

    lines.extend(['', '', 'class PredictionInput(BaseModel):',
                  '    """Input data for making predictions."""'])

    example_dict = {}
    for col in input_columns:
        safe = col.replace(' ', '_').replace('-', '_')
        raw_dtype = str(column_dtypes.get(col, '')).lower()
        
        # 1. Categoricals with explicit categories -> Literal[...]
        if col in categorical_cols and col in category_maps:
            cats = [str(c) for c in category_maps[col] if c != '__missing__']
            if cats:
                literal_vals = ', '.join(f'"{c}"' for c in cats)
                default = str(sample_values.get(col, cats[0]))
                lines.append(f'    {safe}: Literal[{literal_vals}] = Field("{default}", description="Feature: {col}")')
                example_dict[safe] = default
            else:
                default = str(sample_values.get(col, "unknown"))
                lines.append(f'    {safe}: str = Field("{default}", description="Feature: {col}")')
                example_dict[safe] = default
        # 2. String / Object / ID / Datetime columns -> str
        elif any(t in raw_dtype for t in ('object', 'str', 'string', 'category', 'datetime', 'date')) or col in datetime_cols or col in id_cols:
            default = str(sample_values.get(col, "2024-01-15" if (col in datetime_cols or 'date' in raw_dtype) else "sample_value"))
            lines.append(f'    {safe}: str = Field("{default}", description="Feature: {col}")')
            example_dict[safe] = default
        # 3. Integer columns -> int
        elif any(t in raw_dtype for t in ('int', 'integer')):
            try:
                default_int = int(sample_values.get(col, 0))
            except (ValueError, TypeError):
                default_int = 0
            lines.append(f'    {safe}: int = Field({default_int}, description="Feature: {col}")')
            example_dict[safe] = default_int
        # 4. Numeric / Float columns -> float
        elif col in numeric_cols or any(t in raw_dtype for t in ('float', 'numeric', 'number', 'double')):
            try:
                default_float = float(sample_values.get(col, 0.0))
            except (ValueError, TypeError):
                default_float = 0.0
            lines.append(f'    {safe}: float = Field({default_float}, description="Feature: {col}")')
            example_dict[safe] = default_float
        # 5. Default fallback based on sample value type
        else:
            sample_v = sample_values.get(col)
            if isinstance(sample_v, (int, float)):
                lines.append(f'    {safe}: float = Field({float(sample_v)}, description="Feature: {col}")')
                example_dict[safe] = float(sample_v)
            else:
                lines.append(f'    {safe}: str = Field("{str(sample_v or "sample")}", description="Feature: {col}")')
                example_dict[safe] = str(sample_v or "sample")

    # Config with example
    lines.append('')
    lines.append('    class Config:')
    lines.append('        json_schema_extra = {')
    lines.append('            "example": {')
    for k, v in example_dict.items():
        if isinstance(v, str):
            lines.append(f'                "{k}": "{v}",')
        else:
            lines.append(f'                "{k}": {v},')
    lines.append('            }')
    lines.append('        }')

    # Output schema
    lines.extend(['', '', 'class PredictionOutput(BaseModel):',
                  '    """Prediction response."""'])
    if task_type == 'classification':
        lines.append('    prediction: int = Field(..., description="Predicted class")')
        lines.append('    confidence: Optional[float] = Field(None, description="Prediction confidence")')
        lines.append('    probabilities: Optional[dict] = Field(None, description="Class probabilities")')
    else:
        lines.append('    prediction: float = Field(..., description="Predicted value")')
    lines.append('    model_name: str = Field(..., description="Model used for prediction")')
    lines.append('')

    return '\n'.join(lines)


def _generate_main_code(model_name: str, task_type: str, metadata: dict) -> str:
    """Generate main.py source code that loads real preprocessor + model."""
    input_columns_json = json.dumps(metadata.get('input_columns', []))
    numeric_cols_json = json.dumps(metadata.get('numeric_columns', []))
    categorical_cols_json = json.dumps(metadata.get('categorical_columns', []))
    output_columns_json = json.dumps(metadata.get('output_columns', metadata.get('input_columns', [])))
    dropped_id_cols_json = json.dumps(metadata.get('dropped_id_columns', []))
    datetime_cols_json = json.dumps(metadata.get('datetime_columns', []))

    code = f'''"""AutoMLOps Generated Inference API.

Automatically generated FastAPI service for model: {model_name}
Task type: {task_type}
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from schemas import PredictionInput, PredictionOutput
import joblib
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Column declarations (derived from training metadata, not hardcoded guesses) ──
INPUT_COLUMNS = {input_columns_json}
NUMERIC_COLUMNS = {numeric_cols_json}
CATEGORICAL_COLUMNS = {categorical_cols_json}
OUTPUT_COLUMNS = {output_columns_json}
DROPPED_ID_COLUMNS = {dropped_id_cols_json}
DATETIME_COLUMNS = {datetime_cols_json}

# ── Global state ──
_model = None
_preprocessor = None
_startup_ok = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model and preprocessor at startup with validation."""
    global _model, _preprocessor, _startup_ok
    try:
        _preprocessor_bundle = joblib.load("preprocessor.joblib")
        if isinstance(_preprocessor_bundle, dict):
            _preprocessor = _preprocessor_bundle.get("pipeline")
            _meta = _preprocessor_bundle.get("metadata", {{}})
        else:
            _preprocessor = _preprocessor_bundle
            _meta = {{}}

        if _meta.get("_legacy_warning") or _preprocessor is None:
            logger.error(
                "INVALID PREPROCESSOR: Preprocessor is un-fitted or marked as legacy placeholder. "
                "Retrain the model before deploying this API."
            )
            sys.exit(1)

        _model = joblib.load("model.joblib")

        # Startup validation: ensure preprocessor columns match schema declarations
        expected_cols = _meta.get("input_columns", INPUT_COLUMNS)
        if set(expected_cols) != set(INPUT_COLUMNS):
            logger.error(
                f"COLUMN MISMATCH — preprocessor expects {{sorted(expected_cols)}}, "
                f"but schema declares {{sorted(INPUT_COLUMNS)}}. "
                "The deployment package is inconsistent. Regenerate the API."
            )
            sys.exit(1)

        # Smoke check: run a realistic prediction using metadata sample values
        sample_dict = _meta.get("sample_values", {{}})
        dummy = {{}}
        for c in INPUT_COLUMNS:
            val = sample_dict.get(c)
            if val is None:
                val = 0.0 if c in NUMERIC_COLUMNS else ("2024-01-01" if c in DATETIME_COLUMNS else "sample")
            dummy[c] = [val]

        dummy_df = pd.DataFrame(dummy)
        if DROPPED_ID_COLUMNS:
            dummy_df = dummy_df.drop(columns=[c for c in DROPPED_ID_COLUMNS if c in dummy_df.columns], errors="ignore")
        for col in DATETIME_COLUMNS:
            if col in dummy_df.columns:
                dt = pd.to_datetime(dummy_df[col], errors="coerce")
                dummy_df[f"{{col}}_year"] = dt.dt.year.fillna(0).astype(float)
                dummy_df[f"{{col}}_month"] = dt.dt.month.fillna(0).astype(float)
                dummy_df[f"{{col}}_day"] = dt.dt.day.fillna(0).astype(float)
                dummy_df[f"{{col}}_dayofweek"] = dt.dt.dayofweek.fillna(0).astype(float)
                dummy_df = dummy_df.drop(columns=[col], errors="ignore")

        try:
            transformed = _preprocessor.transform(dummy_df)
            _out_cols = getattr(_model, "feature_names_", getattr(_model, "feature_names_in_", OUTPUT_COLUMNS))
            if _out_cols is not None:
                _out_cols = list(_out_cols)
            if not isinstance(transformed, pd.DataFrame):
                if _out_cols is not None and hasattr(transformed, "shape") and len(transformed.shape) > 1 and len(_out_cols) == transformed.shape[1]:
                    transformed = pd.DataFrame(transformed, columns=_out_cols)
                else:
                    transformed = pd.DataFrame(transformed)
            elif _out_cols is not None and len(_out_cols) == transformed.shape[1]:
                transformed.columns = _out_cols
            _model.predict(transformed)
        except Exception as e:
            logger.error(f"Startup smoke-test prediction FAILED: {{e}}")
            sys.exit(1)

        _startup_ok = True
        logger.info("Model and preprocessor loaded successfully. Smoke test passed.")
        yield
    except SystemExit:
        raise
    except Exception as e:
        logger.error(f"Failed to load model/preprocessor: {{e}}")
        sys.exit(1)


# ── CORS from environment ──
cors_origins_str = os.environ.get("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]

app = FastAPI(
    title="{model_name} Prediction API",
    description="Auto-generated inference API by AutoMLOps",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Never leak raw exceptions to clients."""
    logger.exception("Unhandled error during request")
    return JSONResponse(
        status_code=500,
        content={{"detail": "Internal server error. Check server logs for details."}},
    )


@app.get("/")
def root():
    return {{
        "service": "{model_name} Prediction API",
        "status": "running",
        "endpoints": {{
            "predict": "POST /predict",
            "health": "GET /health",
            "docs": "GET /docs",
        }}
    }}


@app.get("/health")
def health_check():
    """Confirm model and preprocessor are loaded and can produce a prediction."""
    return {{
        "status": "healthy" if _startup_ok else "degraded",
        "model": "{model_name}",
        "model_loaded": _model is not None,
        "preprocessor_loaded": _preprocessor is not None,
        "prediction_test": "passed" if _startup_ok else "failed",
    }}


@app.post("/predict", response_model=PredictionOutput)
def predict(data: PredictionInput):
    """Make a prediction using the trained model and fitted preprocessor."""
    input_dict = data.model_dump()
    df = pd.DataFrame([input_dict])

    # Rename snake_case fields back to original column names
    for col in INPUT_COLUMNS:
        safe_col = col.replace(" ", "_").replace("-", "_")
        if safe_col in df.columns and col not in df.columns:
            df = df.rename(columns={{safe_col: col}})

    df = df.reindex(columns=INPUT_COLUMNS)

    # Drop ID columns if they were excluded during training
    if DROPPED_ID_COLUMNS:
        df = df.drop(columns=[c for c in DROPPED_ID_COLUMNS if c in df.columns], errors="ignore")

    # Extract temporal features from datetime columns
    for col in DATETIME_COLUMNS:
        if col in df.columns:
            dt = pd.to_datetime(df[col], errors="coerce")
            df[f"{{col}}_year"] = dt.dt.year.fillna(0).astype(float)
            df[f"{{col}}_month"] = dt.dt.month.fillna(0).astype(float)
            df[f"{{col}}_day"] = dt.dt.day.fillna(0).astype(float)
            df[f"{{col}}_dayofweek"] = dt.dt.dayofweek.fillna(0).astype(float)
            df = df.drop(columns=[col], errors="ignore")

    # Apply the real fitted preprocessor
    transformed = _preprocessor.transform(df)
    _out_cols = getattr(_model, "feature_names_", getattr(_model, "feature_names_in_", OUTPUT_COLUMNS))
    if _out_cols is not None:
        _out_cols = list(_out_cols)
    if not isinstance(transformed, pd.DataFrame):
        if _out_cols is not None and hasattr(transformed, "shape") and len(transformed.shape) > 1 and len(_out_cols) == transformed.shape[1]:
            transformed = pd.DataFrame(transformed, columns=_out_cols)
        else:
            transformed = pd.DataFrame(transformed)
    elif _out_cols is not None and len(_out_cols) == transformed.shape[1]:
        transformed.columns = _out_cols

    prediction = _model.predict(transformed)[0]

    result = {{
        "prediction": {"int(prediction)" if task_type == "classification" else "float(prediction)"},
        "model_name": "{model_name}",
    }}
'''
    if task_type == 'classification':
        code += '''
    # Add probabilities if available
    if hasattr(_model, "predict_proba"):
        try:
            proba = _model.predict_proba(transformed)[0]
            result["confidence"] = float(max(proba))
            result["probabilities"] = {str(i): round(float(p), 4) for i, p in enumerate(proba)}
        except Exception:
            pass
'''

    code += '''
    return result


@app.post("/predict/batch")
def predict_batch(data: list[PredictionInput]):
    """Make batch predictions."""
    results = []
    for item in data:
        results.append(predict(item))
    return {"predictions": results, "count": len(results)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
'''
    return code


def _generate_requirements(model_library: str, model_library_version: str | None) -> str:
    """Generate requirements.txt with exact pinned versions from the training environment."""
    sklearn_ver = _get_library_version('scikit-learn') or '1.3.2'
    fastapi_ver = _get_library_version('fastapi') or '0.104.1'
    uvicorn_ver = _get_library_version('uvicorn') or '0.24.0'
    joblib_ver = _get_library_version('joblib') or '1.3.2'
    pandas_ver = _get_library_version('pandas') or '2.1.4'
    numpy_ver = _get_library_version('numpy') or '1.26.2'

    lines = [
        f'fastapi=={fastapi_ver}',
        f'uvicorn[standard]=={uvicorn_ver}',
        f'joblib=={joblib_ver}',
        f'pandas=={pandas_ver}',
        f'numpy=={numpy_ver}',
        f'scikit-learn=={sklearn_ver}',
    ]

    # Add model-specific library if it's not sklearn
    if model_library and model_library != 'scikit-learn':
        lib_ver = model_library_version or _get_library_version(model_library)
        if lib_ver:
            lines.append(f'{model_library}=={lib_ver}')
        else:
            lines.append(f'{model_library}')

    return '\n'.join(lines) + '\n'


def _run_smoke_test(gen_dir: str, metadata: dict) -> tuple[bool, str]:
    """Run a realistic smoke test: load the artifacts and verify the schema-declared example predicts successfully."""
    import joblib as jl
    import pandas as pd
    try:
        # Load artifacts
        preprocessor_bundle = jl.load(os.path.join(gen_dir, 'preprocessor.joblib'))
        if isinstance(preprocessor_bundle, dict):
            pipeline = preprocessor_bundle.get('pipeline')
            meta = preprocessor_bundle.get('metadata', metadata)
        else:
            pipeline = preprocessor_bundle
            meta = metadata

        if meta.get('_legacy_warning') or pipeline is None or not hasattr(pipeline, 'transform'):
            return False, "Model is using an un-fitted legacy preprocessor. Retraining required."

        model = jl.load(os.path.join(gen_dir, 'model.joblib'))

        input_columns = meta.get('input_columns', [])
        sample_values = meta.get('sample_values', {})
        numeric_cols = set(meta.get('numeric_columns', []))
        categorical_cols = set(meta.get('categorical_columns', []))
        datetime_cols = set(meta.get('datetime_columns', []))
        id_cols = set(meta.get('dropped_id_columns', []))
        column_dtypes = meta.get('column_dtypes', {})

        example = {}
        for col in input_columns:
            dtype_str = str(column_dtypes.get(col, '')).lower()
            if col in categorical_cols:
                cats = meta.get('category_maps', {}).get(col, ['__missing__'])
                example[col] = [str(sample_values.get(col, cats[0] if cats else '__missing__'))]
            elif any(t in dtype_str for t in ('object', 'str', 'string', 'category', 'datetime', 'date')) or col in datetime_cols or col in id_cols:
                example[col] = [str(sample_values.get(col, "2024-01-15" if (col in datetime_cols or 'date' in dtype_str) else "test_id"))]
            elif any(t in dtype_str for t in ('int', 'integer')):
                try:
                    example[col] = [int(sample_values.get(col, 0))]
                except (ValueError, TypeError):
                    example[col] = [0]
            else:
                try:
                    example[col] = [float(sample_values.get(col, 0.0))]
                except (ValueError, TypeError):
                    example[col] = [0.0]

        df = pd.DataFrame(example)

        # Apply same transformations as main.py:
        if id_cols:
            df = df.drop(columns=[c for c in id_cols if c in df.columns], errors="ignore")
        for col in datetime_cols:
            if col in df.columns:
                dt = pd.to_datetime(df[col], errors="coerce")
                df[f"{col}_year"] = dt.dt.year.fillna(0).astype(float)
                df[f"{col}_month"] = dt.dt.month.fillna(0).astype(float)
                df[f"{col}_day"] = dt.dt.day.fillna(0).astype(float)
                df[f"{col}_dayofweek"] = dt.dt.dayofweek.fillna(0).astype(float)
                df = df.drop(columns=[col], errors="ignore")

        transformed = pipeline.transform(df)
        raw_cols = getattr(model, 'feature_names_', getattr(model, 'feature_names_in_', meta.get('output_columns')))
        expected_cols = list(raw_cols) if raw_cols is not None else None
        if not isinstance(transformed, pd.DataFrame):
            n_cols = transformed.shape[1] if hasattr(transformed, 'shape') and len(transformed.shape) > 1 else (len(transformed[0]) if len(transformed) > 0 else 0)
            if expected_cols is not None and len(expected_cols) == n_cols:
                transformed = pd.DataFrame(transformed, columns=expected_cols)
            else:
                transformed = pd.DataFrame(transformed)
        elif expected_cols is not None and len(expected_cols) == transformed.shape[1]:
            transformed.columns = expected_cols

        prediction = model.predict(transformed)

        if prediction is None or len(prediction) == 0:
            return False, "Model returned empty prediction"

        return True, f"Smoke test passed with schema-validated payload. Prediction: {prediction[0]}"
    except Exception as e:
        return False, f"Smoke test FAILED: {type(e).__name__}: {e}"


def generate_api(
    model_path: str,
    model_name: str,
    task_type: str = 'classification',
    preprocessor_path: str | None = None,
    preprocessing_metadata: dict | None = None,
    model_library: str = 'scikit-learn',
    model_library_version: str | None = None,
    feature_names: list[str] | None = None,
    feature_types: dict[str, str] | None = None,
) -> dict:
    """Generate a complete FastAPI inference project.

    Args:
        model_path: Path to the saved model (.joblib)
        model_name: Name for the generated API
        task_type: 'classification' or 'regression'
        preprocessor_path: Path to the fitted preprocessor (.joblib). Required for deployment.
        preprocessing_metadata: Metadata dict from training.
        model_library: The ML library used (e.g. 'catboost', 'xgboost', 'scikit-learn')
        model_library_version: Pinned version of that library
        feature_names: Fallback feature names
        feature_types: Fallback feature type dict

    Returns:
        Dict with code_path, dockerfile_path, requirements, zip_path, smoke_test_result
    """
    import joblib
    import re

    safe_model_name = re.sub(r'[^a-zA-Z0-9_-]', '_', model_name)
    resolved_model_path = resolve_artifact_path(model_path)
    resolved_preprocessor_path = resolve_artifact_path(preprocessor_path)

    gen_dir = os.path.join(settings.MODEL_REGISTRY_DIR, f"generated_api_{safe_model_name}")
    if os.path.exists(gen_dir):
        shutil.rmtree(gen_dir)
    os.makedirs(gen_dir, exist_ok=True)

    # ── Copy model ──
    if not resolved_model_path or not os.path.exists(resolved_model_path):
        raise RuntimeError(f"Model artifact not found for '{model_name}' at path '{model_path}'")
    shutil.copy2(resolved_model_path, os.path.join(gen_dir, "model.joblib"))

    # ── Load preprocessor ──
    if resolved_preprocessor_path and os.path.exists(resolved_preprocessor_path):
        shutil.copy2(resolved_preprocessor_path, os.path.join(gen_dir, "preprocessor.joblib"))
        bundle = joblib.load(resolved_preprocessor_path)
        if isinstance(bundle, dict):
            metadata = bundle.get('metadata', {})
        else:
            metadata = preprocessing_metadata or {}
    else:
        # Block export of models that lack a fitted preprocessing pipeline
        shutil.rmtree(gen_dir, ignore_errors=True)
        raise RuntimeError(
            f"Model '{model_name}' was trained without a persisted preprocessing pipeline. "
            "Please retrain the model in AutoMLOps to generate a deployable API package."
        )

    # Override with explicit metadata if provided
    if preprocessing_metadata:
        metadata = preprocessing_metadata

    # ── Detect actual task type from the model object itself ──
    try:
        model_obj = joblib.load(os.path.join(gen_dir, "model.joblib"))
        task_type = _detect_task_type(model_obj, fallback=task_type)
    except Exception as e:
        logger.warning(f"Could not introspect model object for task type: {e}")

    # Introspect model library if not explicitly provided
    if model_library == 'scikit-learn' and model_library_version is None:
        model_library, model_library_version = _detect_model_library(resolved_model_path)

    # ── Generate schemas.py ──
    schemas_code = _generate_schemas_code(metadata, task_type)
    _write_file(gen_dir, 'schemas.py', schemas_code)

    # ── Generate main.py ──
    main_code = _generate_main_code(safe_model_name, task_type, metadata)
    _write_file(gen_dir, 'main.py', main_code)

    # ── Generate requirements.txt ──
    requirements_txt = _generate_requirements(model_library, model_library_version)
    _write_file(gen_dir, 'requirements.txt', requirements_txt)

    # ── Generate Dockerfile ──
    dockerfile = """FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s \\
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""
    _write_file(gen_dir, 'Dockerfile', dockerfile)

    # ── Generate .dockerignore ──
    _write_file(gen_dir, '.dockerignore', "__pycache__\n*.pyc\n.git\n.env\n")

    # ── Generate README.md ──
    input_cols = metadata.get('input_columns', [])
    sample_vals = metadata.get('sample_values', {})
    sample_fields = []
    for col in input_cols[:6]:
        safe = col.replace(' ', '_').replace('-', '_')
        val = sample_vals.get(col, 0.0)
        if isinstance(val, str):
            sample_fields.append(f'"{safe}": "{val}"')
        else:
            sample_fields.append(f'"{safe}": {val}')
    sample_curl = ', '.join(sample_fields)

    readme = f"""# {model_name} Prediction API

Auto-generated inference API by **AutoMLOps**.

This package includes:
- `model.joblib` — the trained model
- `preprocessor.joblib` — the fitted preprocessing pipeline from training
- `main.py` — FastAPI inference server
- `schemas.py` — Pydantic request/response schemas with validated types

## Quick Start

### Run Locally
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Run with Docker
```bash
docker build -t {model_name.lower().replace(' ', '-')}-api .
docker run -p 8000:8000 {model_name.lower().replace(' ', '-')}-api
```

### Configure CORS
Set the `CORS_ORIGINS` environment variable (comma-separated):
```bash
CORS_ORIGINS="https://myapp.com,https://admin.myapp.com" uvicorn main:app --port 8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check (verifies model + preprocessor loaded, runs test prediction) |
| GET | `/docs` | Swagger UI |
| POST | `/predict` | Single prediction |
| POST | `/predict/batch` | Batch predictions |

## Sample Request

```bash
curl -X POST http://localhost:8000/predict \\
  -H "Content-Type: application/json" \\
  -d '{{{sample_curl}}}'
```

## Model Info
- **Model**: {model_name}
- **Task**: {task_type}
- **Model library**: {model_library} {model_library_version or ''}
- **Features**: {len(input_cols)}
- **Preprocessing**: Real fitted pipeline from training
"""
    _write_file(gen_dir, 'README.md', readme)

    # ── Run smoke test ──
    smoke_passed, smoke_msg = _run_smoke_test(gen_dir, metadata)
    logger.info(f"API smoke test for '{model_name}': {smoke_msg}")

    if not smoke_passed:
        # Clean up and raise — don't offer a broken ZIP
        shutil.rmtree(gen_dir, ignore_errors=True)
        raise RuntimeError(f"API generation smoke test failed for '{model_name}': {smoke_msg}")

    # ── Create ZIP archive ──
    zip_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{model_name}_api.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(gen_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, gen_dir)
                zipf.write(file_path, arcname)

    # Build requirements dict for DB storage
    req_dict = {
        'scikit-learn': _get_library_version('scikit-learn') or '1.3.2',
        'fastapi': _get_library_version('fastapi') or '0.104.1',
        'joblib': _get_library_version('joblib') or '1.3.2',
        'pandas': _get_library_version('pandas') or '2.1.4',
        'numpy': _get_library_version('numpy') or '1.26.2',
    }
    if model_library and model_library != 'scikit-learn':
        req_dict[model_library] = model_library_version or ''

    return {
        'code_path': gen_dir,
        'dockerfile_path': os.path.join(gen_dir, 'Dockerfile'),
        'zip_path': zip_path,
        'requirements': req_dict,
        'files_generated': os.listdir(gen_dir),
        'smoke_test': smoke_msg,
    }


def _write_file(directory: str, filename: str, content: str) -> None:
    """Write content to a file in the given directory."""
    with open(os.path.join(directory, filename), 'w', encoding='utf-8') as f:
        f.write(content)
