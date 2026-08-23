"""
Auto-provisioning seed module for AutoMLOps.

On every cold start (Render redeploy / wake from sleep), this module checks
if the database is empty and auto-provisions a demo user, project, dataset,
and pre-trained models so all 12 features work instantly without manual uploads.
"""
import os
import pandas as pd  # type: ignore
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore
from sqlalchemy.future import select  # type: ignore
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.trained_model import TrainedModel
from app.config import settings
from app.core.security import hash_password


import numpy as np  # type: ignore

DEMO_EMAIL = "demo@automlops.ai"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "Demo1234!"

def generate_benchmark_churn_data(n_samples: int = 150) -> pd.DataFrame:
    np.random.seed(42)
    tenures = np.random.randint(1, 73, size=n_samples)
    charges = np.round(np.random.uniform(20.0, 115.0, size=n_samples), 2)
    contracts = np.random.choice(["Month-to-Month", "One year", "Two year"], size=n_samples, p=[0.55, 0.25, 0.20])
    tickets = np.random.poisson(lam=1.2, size=n_samples)
    
    # Business logic driven churn target
    prob = 1.0 / (1.0 + np.exp(-(0.03 * charges - 0.04 * tenures + 0.4 * tickets - 0.5)))
    churn = (np.random.rand(n_samples) < prob).astype(int)
    
    return pd.DataFrame({
        "tenure": tenures,
        "monthly_charges": charges,
        "contract_type": contracts,
        "support_tickets": tickets,
        "churn": churn
    })


async def seed_demo_data(db: AsyncSession) -> None:
    """Check if database is empty and seed demo data if so."""
    # Check if any user exists
    result = await db.execute(select(User).limit(1))
    if result.scalars().first() is not None:
        return  # Database already has data, skip seeding

    print("[SEED] Empty database detected — auto-provisioning demo data...")

    # 1. Create demo user
    hashed_pw = hash_password(DEMO_PASSWORD)
    demo_user = User(
        email=DEMO_EMAIL,
        username=DEMO_USERNAME,
        hashed_password=hashed_pw,
        is_active=True,
    )
    db.add(demo_user)
    await db.commit()
    await db.refresh(demo_user)
    print(f"[SEED] Created demo user: {DEMO_EMAIL}")

    # 2. Create demo project
    demo_project = Project(
        user_id=demo_user.id,
        name="Customer Churn Prediction",
        description="Demo project: Predict which customers are likely to churn based on usage patterns.",
        task_type="classification",
        target_column="churn",
        status="trained",
    )
    db.add(demo_project)
    await db.commit()
    await db.refresh(demo_project)
    print(f"[SEED] Created demo project: {demo_project.name} ({demo_project.id})")

    # 3. Save sample dataset CSV
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    csv_path = os.path.join(settings.UPLOAD_DIR, "customer_churn_demo.csv")
    df = generate_benchmark_churn_data(150)
    df.to_csv(csv_path, index=False)

    demo_dataset = Dataset(
        project_id=demo_project.id,
        filename="customer_churn_demo.csv",
        file_path=csv_path,
        file_type="csv",
        file_size=os.path.getsize(csv_path),
        row_count=len(df),
        column_count=len(df.columns),
        columns_info={col: str(df[col].dtype) for col in df.columns},
    )
    db.add(demo_dataset)
    await db.commit()
    await db.refresh(demo_dataset)
    print(f"[SEED] Created demo dataset: {demo_dataset.filename} ({demo_dataset.row_count} rows)")

    # 4. Train models and save to DB
    try:
        from app.engines.automl_engine import train_models

        X = df.drop(columns=["churn"])
        y = df["churn"]
        models_info, dataset_stats = train_models(X, y, "classification", str(demo_project.id), raw_df=df)

        db_models = []
        for info in models_info:
            model = TrainedModel(
                project_id=demo_project.id,
                algorithm=info["algorithm"],
                hyperparameters=info["hyperparameters"],
                metrics=info["metrics"],
                model_path=info.get("model_path") or "",
                training_time_seconds=info["training_time_seconds"],
            )
            db.add(model)
            db_models.append(model)

        await db.commit()
        for m in db_models:
            await db.refresh(m)

        # Mark best model as selected
        if db_models:
            best = max(db_models, key=lambda m: (m.metrics or {}).get("accuracy", 0))
            best.is_selected = True
            await db.commit()
            print(f"[SEED] Trained {len(db_models)} models. Best: {best.algorithm} (accuracy={best.metrics.get('accuracy', 0):.4f})")
    except Exception as e:
        print(f"[SEED] Warning: Model training during seed failed ({e}), features will still work with fallback data.")

    print("[SEED] Demo data provisioning complete! All 12 features are ready.")
