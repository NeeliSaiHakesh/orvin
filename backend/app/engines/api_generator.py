"""Inference API Generator for AutoMLOps.

Generates a complete, production-ready FastAPI inference service
including prediction endpoint, input validation, Swagger docs,
Dockerfile, and sample requests.
"""
import os
import zipfile
import json
import shutil
from typing import Any
from app.config import settings


def generate_api(
    model_path: str,
    feature_names: list[str],
    feature_types: dict[str, str],
    model_name: str,
    task_type: str = 'classification',
) -> dict:
    """Generate a complete FastAPI inference project.
    
    Args:
        model_path: Path to the saved model (.joblib)
        feature_names: List of feature column names
        feature_types: Dict mapping feature names to their types
        model_name: Name for the generated API
        task_type: 'classification' or 'regression'
    
    Returns:
        Dict with code_path, dockerfile_path, requirements, zip_path
    """
    gen_dir = os.path.join(settings.MODEL_REGISTRY_DIR, f"generated_api_{model_name}")
    if os.path.exists(gen_dir):
        shutil.rmtree(gen_dir)
    os.makedirs(gen_dir, exist_ok=True)
    
    # Copy model file
    model_dest = os.path.join(gen_dir, "model.joblib")
    shutil.copy2(model_path, model_dest)
    
    # ── Generate schemas.py ──
    fields = []
    for f in feature_names:
        ftype = feature_types.get(f, 'float64')
        if ftype in ('float64', 'float32', 'float'):
            pytype = 'float'
            example = '0.0'
        elif ftype in ('int64', 'int32', 'int'):
            pytype = 'int'
            example = '0'
        else:
            pytype = 'str'
            example = '"value"'
        fields.append((f, pytype, example))
    
    schemas_code = '''"""Request and response schemas for the prediction API."""\nfrom pydantic import BaseModel, Field\nfrom typing import Optional\n\n\nclass PredictionInput(BaseModel):\n    """Input data for making predictions."""\n'''
    for fname, ftype, example in fields:
        safe_name = fname.replace(' ', '_').replace('-', '_')
        schemas_code += f'    {safe_name}: {ftype} = Field(..., description="Feature: {fname}")\n'
    
    schemas_code += '''\n    class Config:\n        json_schema_extra = {\n            "example": {\n'''
    for fname, ftype, example in fields:
        safe_name = fname.replace(' ', '_').replace('-', '_')
        schemas_code += f'                "{safe_name}": {example},\n'
    schemas_code += '''            }\n        }\n\n\nclass PredictionOutput(BaseModel):\n    """Prediction response."""\n'''
    if task_type == 'classification':
        schemas_code += '    prediction: int = Field(..., description="Predicted class")\n'
        schemas_code += '    confidence: Optional[float] = Field(None, description="Prediction confidence")\n'
        schemas_code += '    probabilities: Optional[dict] = Field(None, description="Class probabilities")\n'
    else:
        schemas_code += '    prediction: float = Field(..., description="Predicted value")\n'
    schemas_code += '    model_name: str = Field(..., description="Model used for prediction")\n'
    
    _write_file(gen_dir, 'schemas.py', schemas_code)
    
    # ── Generate main.py ──
    feature_list = json.dumps(feature_names)
    main_code = f'''"""AutoMLOps Generated Inference API.\n\nAutomatically generated FastAPI service for model: {model_name}\nTask type: {task_type}\n"""\nfrom fastapi import FastAPI, HTTPException\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom schemas import PredictionInput, PredictionOutput\nimport joblib\nimport pandas as pd\nimport numpy as np\nimport time\n\n# Initialize app\napp = FastAPI(\n    title="{model_name} Prediction API",\n    description="Auto-generated inference API by AutoMLOps",\n    version="1.0.0",\n)\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=["*"],\n    allow_methods=["*"],\n    allow_headers=["*"],\n)\n\n# Load model at startup\nmodel = joblib.load("model.joblib")\nFEATURE_NAMES = {feature_list}\n\n\n@app.get("/")\ndef root():\n    return {{\n        "service": "{model_name} Prediction API",\n        "status": "running",\n        "endpoints": {{\n            "predict": "POST /predict",\n            "health": "GET /health",\n            "docs": "GET /docs",\n        }}\n    }}\n\n\n@app.get("/health")\ndef health_check():\n    return {{"status": "healthy", "model": "{model_name}"}}\n\n\n@app.post("/predict", response_model=PredictionOutput)\ndef predict(data: PredictionInput):\n    """Make a prediction using the trained model."""\n    try:\n        start = time.time()\n        input_dict = data.model_dump()\n        df = pd.DataFrame([input_dict])\n        \n        # Ensure correct column order\n        for col in FEATURE_NAMES:\n            safe_col = col.replace(" ", "_").replace("-", "_")\n            if safe_col in df.columns and col != safe_col:\n                df = df.rename(columns={{safe_col: col}})\n        \n        df = df.reindex(columns=FEATURE_NAMES, fill_value=0)\n        prediction = model.predict(df)[0]\n        \n        result = {{\n            "prediction": {"int(prediction)" if task_type == "classification" else "float(prediction)"},\n            "model_name": "{model_name}",\n        }}\n'''
    if task_type == 'classification':
        main_code += '''        \n        # Add probabilities if available\n        if hasattr(model, "predict_proba"):\n            proba = model.predict_proba(df)[0]\n            result["confidence"] = float(max(proba))\n            result["probabilities"] = {str(i): round(float(p), 4) for i, p in enumerate(proba)}\n'''
    main_code += f'''        \n        return result\n    except Exception as e:\n        raise HTTPException(status_code=500, detail=str(e))\n\n\n@app.post("/predict/batch")\ndef predict_batch(data: list[PredictionInput]):\n    """Make batch predictions."""\n    results = []\n    for item in data:\n        results.append(predict(item))\n    return {{"predictions": results, "count": len(results)}}\n\n\nif __name__ == "__main__":\n    import uvicorn\n    uvicorn.run(app, host="0.0.0.0", port=8000)\n'''
    _write_file(gen_dir, 'main.py', main_code)
    
    # ── Generate requirements.txt ──
    requirements = """fastapi==0.104.1
uvicorn[standard]==0.24.0
joblib==1.3.2
pandas==2.1.4
numpy==1.26.2
scikit-learn==1.3.2
"""
    _write_file(gen_dir, 'requirements.txt', requirements)
    
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
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s \\
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""
    _write_file(gen_dir, 'Dockerfile', dockerfile)
    
    # ── Generate .dockerignore ──
    dockerignore = """__pycache__
*.pyc
.git
.env
*.md
"""
    _write_file(gen_dir, '.dockerignore', dockerignore)
    
    # ── Generate README.md ──
    sample_curl_fields = ', '.join(f'"{fname.replace(" ", "_").replace("-", "_")}": {example}' for fname, _, example in fields[:5])
    readme = f"""# {model_name} Prediction API

Auto-generated inference API by **AutoMLOps**.

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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |
| POST | `/predict` | Single prediction |
| POST | `/predict/batch` | Batch predictions |

## Sample Request

```bash
curl -X POST http://localhost:8000/predict \\
  -H "Content-Type: application/json" \\
  -d '{{{sample_curl_fields}}}'
```

## Model Info
- **Model**: {model_name}
- **Task**: {task_type}
- **Features**: {len(feature_names)}
"""
    _write_file(gen_dir, 'README.md', readme)
    
    # ── Create ZIP archive ──
    zip_path = os.path.join(settings.MODEL_REGISTRY_DIR, f"{model_name}_api.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(gen_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, gen_dir)
                zipf.write(file_path, arcname)
    
    return {
        'code_path': gen_dir,
        'dockerfile_path': os.path.join(gen_dir, 'Dockerfile'),
        'zip_path': zip_path,
        'requirements': {
            'fastapi': '0.104.1',
            'uvicorn': '0.24.0',
            'joblib': '1.3.2',
            'pandas': '2.1.4',
            'scikit-learn': '1.3.2',
        },
        'files_generated': os.listdir(gen_dir),
    }


def _write_file(directory: str, filename: str, content: str) -> None:
    """Write content to a file in the given directory."""
    with open(os.path.join(directory, filename), 'w') as f:
        f.write(content)
