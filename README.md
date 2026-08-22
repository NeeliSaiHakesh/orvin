# 🚀 AutoMLOps

> **AI-Powered MLOps Platform** — From raw data to production-deployed ML models, fully automated.

AutoMLOps is an end-to-end machine learning operations platform that automates the entire ML lifecycle: dataset analysis, data cleaning, feature engineering, model training, explainability, API generation, containerization, deployment, monitoring, and retraining.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Dataset Intelligence** | Automatic data profiling, type detection, outlier detection, missing value analysis |
| 🧹 **AI Data Cleaning** | Smart data cleaning with AI-powered suggestions |
| 🔧 **Feature Engineering** | Automated feature selection, encoding, scaling, and transformation |
| 🤖 **AutoML Engine** | Train and compare 7+ ML models with hyperparameter tuning |
| 🔍 **Explainable AI** | SHAP values, feature importance, confusion matrices, ROC curves |
| 🌐 **API Generator** | Auto-generate production-ready FastAPI inference services |
| 🐳 **Docker Intelligence** | Optimized Dockerfiles with security best practices |
| ☸️ **K8s Deployment** | Kubernetes manifest generation |
| 🔄 **CI/CD Automation** | GitHub Actions workflow generation |
| 📈 **Monitoring** | Prometheus + Grafana integration |
| 🎯 **Drift Detection** | Data, feature, and concept drift monitoring |
| 🤖 **AI Assistant** | Conversational MLOps assistant |

---

## 🏗️ Tech Stack

- **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Plotly.js
- **Backend**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15 + SQLAlchemy 2.0 (async)
- **Cache**: Redis 7
- **ML**: Scikit-learn, XGBoost, LightGBM, CatBoost
- **Explainability**: SHAP
- **Containers**: Docker + Docker Compose

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url> automlops
cd automlops

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Manual Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```
automlops/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/       # App Router pages
│   │   ├── components/ # Reusable components
│   │   └── lib/       # Utilities & API client
│   └── package.json
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── routers/   # API routes
│   │   ├── services/  # Business logic
│   │   ├── engines/   # ML/AI engines
│   │   └── core/      # Security & dependencies
│   └── requirements.txt
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── .env.example
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/auth/me` | Get current user |
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| POST | `/api/v1/projects/{id}/datasets` | Upload dataset |
| POST | `/api/v1/datasets/{id}/analyze` | Analyze dataset |
| POST | `/api/v1/datasets/{id}/clean/apply` | Clean dataset |
| POST | `/api/v1/datasets/{id}/features/engineer` | Engineer features |
| POST | `/api/v1/projects/{id}/train` | Train models |
| GET | `/api/v1/projects/{id}/leaderboard` | Model leaderboard |
| GET | `/api/v1/models/{id}/explain` | Model explanation |
| POST | `/api/v1/models/{id}/generate-api` | Generate API |

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
