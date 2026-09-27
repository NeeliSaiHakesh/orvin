import asyncio
import os
import sys
import pandas as pd
from typing import cast

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal, init_db
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.user import User
from app.schemas.cleaning import CleaningConfig
from app.routers.cleaning import apply_cleaning
from app.routers.features import engineer
from app.routers.analysis import run_analysis
from app.routers.version_lineage import get_project_version_history
from sqlalchemy.future import select

async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        # 1. Create or get test user & project
        user_res = await db.execute(select(User))
        user = user_res.scalars().first()
        if not user:
            user = User(email="test@automlops.ai", username="testuser", hashed_password="pw")
            db.add(user)
            await db.commit()
            await db.refresh(user)

        project = Project(
            name="Versioning Test Project", 
            user_id=str(user.id), 
            task_type="classification", 
            target_column="target"
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        proj_id: str = str(project.id)
        print(f"Created project: {proj_id}")

        # 2. Create dummy raw CSV for v1
        os.makedirs("./uploads", exist_ok=True)
        raw_csv_path = f"./uploads/{proj_id[:8]}_v1_raw_test.csv"
        df_raw = pd.DataFrame({
            "age": [25, 30, None, 45, 50, 25],  # Has missing value and duplicate
            "city": ["NY", "LA", "NY", "SF", "LA", "NY"],
            "income": [50000, 60000, 55000, 120000, 90000, 50000],
            "target": [0, 1, 0, 1, 1, 0]
        })
        df_raw.to_csv(raw_csv_path, index=False)

        ds_v1 = Dataset(
            project_id=proj_id,
            filename="raw_test.csv",
            file_path=raw_csv_path,
            file_type="csv",
            file_size=os.path.getsize(raw_csv_path),
            file_hash="dummy_hash_v1",
            version=1,
            row_count=len(df_raw),
            column_count=len(df_raw.columns),
            status="uploaded"
        )
        db.add(ds_v1)
        await db.commit()
        await db.refresh(ds_v1)
        ds_v1_id: str = str(ds_v1.id)
        print(f"Ingested Dataset v1: ID={ds_v1_id}, Version={ds_v1.version}, Status={ds_v1.status}, Rows={ds_v1.row_count}")

        # Run Analysis on v1
        await run_analysis(ds_v1_id, db, user)
        await db.refresh(ds_v1)
        print(f"Analyzed Dataset v1: Status={ds_v1.status}")
        assert ds_v1.status == "analyzed"

        # 3. Apply Cleaning on v1 -> Should create v2
        clean_cfg = CleaningConfig(fill_missing=True, remove_duplicates=True, handle_outliers=False)
        clean_res = await apply_cleaning(ds_v1_id, clean_cfg, db, user)
        new_v2_id = cast(str, clean_res.new_dataset_id)
        print(f"Cleaning Applied: New Dataset ID={new_v2_id}, Version={clean_res.dataset_version}, Message={clean_res.message}")
        assert clean_res.dataset_version == 2
        assert new_v2_id is not None

        # Verify v1 is untouched and v2 exists
        v2_res = await db.execute(select(Dataset).filter(Dataset.id == new_v2_id))
        ds_v2 = v2_res.scalars().first()
        assert ds_v2 is not None
        assert ds_v2.row_count is not None
        assert ds_v1.row_count is not None

        print(f"Created Dataset v2: ID={ds_v2.id}, Version={ds_v2.version}, Status={ds_v2.status}, Rows={ds_v2.row_count}")
        assert ds_v2.version == 2
        assert ds_v2.status == "cleaned"
        assert ds_v2.row_count < ds_v1.row_count  # Deduplication removed rows

        # 4. Apply Feature Engineering on v2 -> Should create v3
        ds_v2_id: str = str(ds_v2.id)
        feat_res = await engineer(ds_v2_id, db, user)
        new_v3_id = cast(str, feat_res.get("new_dataset_id"))
        print(f"Feature Engineering Applied: New Dataset ID={new_v3_id}, Version={feat_res.get('dataset_version')}")
        assert feat_res.get("dataset_version") == 3
        assert new_v3_id is not None

        v3_res = await db.execute(select(Dataset).filter(Dataset.id == new_v3_id))
        ds_v3 = v3_res.scalars().first()
        assert ds_v3 is not None
        assert ds_v3.column_count is not None
        assert ds_v2.column_count is not None

        print(f"Created Dataset v3: ID={ds_v3.id}, Version={ds_v3.version}, Status={ds_v3.status}, Cols={ds_v3.column_count}")
        assert ds_v3.version == 3
        assert ds_v3.status == "features_engineered"
        assert ds_v3.column_count > ds_v2.column_count  # Categorical encoding added columns

        # 5. Check Lineage Chain
        lineage = await get_project_version_history(proj_id, db, user)
        print(f"\n--- Provenance History for Project ---")
        print(f"Total Versions: {lineage['total_versions']}")
        for chain in lineage["chains"]:
            ds_info = chain["dataset"]
            print(f"  * Version v{chain['version']} (Active: {chain['is_active']}):")
            print(f"    - File: {ds_info['filename']} (Status: {ds_info['status']}, Rows: {ds_info['row_count']}, Cols: {ds_info['column_count']})")

        assert len(lineage["chains"]) == 3
        print("\nALL PROGRESSIVE PIPELINE VERSIONING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
