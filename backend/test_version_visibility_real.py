import asyncio
import os
import sys
import sqlite3
import pandas as pd
from httpx import AsyncClient, ASGITransport

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.main import app
from app.database import init_db
from app.core.security import create_access_token

async def main():
    print("=" * 75)
    print("[TEST SUITE] REAL TEST: INLINE VERSION VISIBILITY & CENTRALIZED LINEAGE")
    print("=" * 75)

    await init_db()
    db_path = os.path.join(BASE_DIR, "automlops.db")
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = create_access_token(data={"sub": "demo@automlops.ai"})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a dedicated multi-version project
        print("\n[STEP 1] Creating Test Project for Version Lineage:")
        proj_res = await client.post(
            "/api/v1/projects",
            json={"name": "Provenance Lineage Test Project", "description": "Testing full multi-layer version chain"},
            headers=headers
        )
        assert proj_res.status_code == 200, f"Project creation failed: {proj_res.text}"
        project_id = proj_res.json()["id"]
        print(f"  [PASS] Created Project ID: {project_id}")

        # 2. Upload Dataset Version 1
        print("\n[STEP 2] Uploading Dataset Version 1 (v1):")
        csv_v1 = os.path.join(BASE_DIR, "temp_data_v1.csv")
        pd.DataFrame({
            "feature_x": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
            "feature_y": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            "target": [0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
        }).to_csv(csv_v1, index=False)

        with open(csv_v1, "rb") as f:
            up1_res = await client.post(f"/api/v1/projects/{project_id}/datasets", files={"file": ("dataset_v1.csv", f, "text/csv")}, headers=headers)
        assert up1_res.status_code == 200
        ds1 = up1_res.json()
        print(f"  [PASS] Dataset v1 Uploaded (ID: {ds1['id'][:8]}..., Hash: {ds1['file_hash'][:12]}...)")

        # 3. Train Model Version 1
        print("\n[STEP 3] Training Pipeline & Model Version 1 (v1):")
        t1_res = await client.post(
            f"/api/v1/projects/{project_id}/train",
            json={"test_size": 0.2, "cv_folds": 2, "scoring_metric": "accuracy", "dataset_id": ds1["id"], "models_to_train": ["LogisticRegression", "DecisionTree"]},
            headers=headers
        )
        assert t1_res.status_code == 200
        t1_data = t1_res.json()
        model_v1_id = t1_data["best_model_id"]
        print(f"  [PASS] Model Version v1 Trained (Active Model ID: {model_v1_id[:8]}...)")

        # 4. Upload Dataset Version 2 (with additional rows/features)
        print("\n[STEP 4] Uploading Dataset Version 2 (v2):")
        csv_v2 = os.path.join(BASE_DIR, "temp_data_v2.csv")
        pd.DataFrame({
            "feature_x": [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9, 11.0, 12.0, 13.0],
            "feature_y": [12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112, 122],
            "target": [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
        }).to_csv(csv_v2, index=False)

        with open(csv_v2, "rb") as f:
            up2_res = await client.post(f"/api/v1/projects/{project_id}/datasets", files={"file": ("dataset_v2.csv", f, "text/csv")}, headers=headers)
        assert up2_res.status_code == 200
        ds2 = up2_res.json()
        print(f"  [PASS] Dataset v2 Uploaded (ID: {ds2['id'][:8]}..., Version: v{ds2['version']})")

        # 5. Train Model Version 2
        print("\n[STEP 5] Training Pipeline & Model Version 2 (v2):")
        t2_res = await client.post(
            f"/api/v1/projects/{project_id}/train",
            json={"test_size": 0.2, "cv_folds": 2, "scoring_metric": "accuracy", "dataset_id": ds2["id"], "models_to_train": ["RandomForest", "DecisionTree"]},
            headers=headers
        )
        assert t2_res.status_code == 200
        t2_data = t2_res.json()
        model_v2_id = t2_data["best_model_id"]
        print(f"  [PASS] Model Version v2 Trained (Active Model ID: {model_v2_id[:8]}...)")

        # 6. Test GET /api/v1/projects/{project_id}/version-history (Centralized Lineage Chain)
        print("\n[STEP 6] Query GET /api/v1/projects/{project_id}/version-history (Full Lineage):")
        hist_res = await client.get(f"/api/v1/projects/{project_id}/version-history", headers=headers)
        assert hist_res.status_code == 200
        history = hist_res.json()
        print(f"  HTTP Status: {hist_res.status_code}")
        print(f"  Project: {history['project_name']}")
        print(f"  Active Version: v{history['active_version']}")
        print(f"  Total Chains in History: {len(history['chains'])}")
        
        for c in history['chains']:
            print(f"\n  === PROVENANCE CHAIN v{c['version']} (Active: {c['is_active']}) ===")
            print(f"    Layer 1 (Dataset): {c['dataset']['filename']} (v{c['dataset']['version']}, {c['dataset']['row_count']} rows, hash: {str(c['dataset']['file_hash'])[:10]}...)")
            print(f"    Layer 2 (Recipe):  {c['recipe']['recipe_version']} ({c['recipe']['applied_steps_count']} steps, {c['recipe']['cv_folds']}-fold CV)")
            print(f"    Layer 3 (Model):   {c['model']['algorithm']} v{c['model']['version']} (Acc: {c['model']['metrics'].get('accuracy')}, Selected: {c['model']['is_selected']})")
            print(f"    Layer 4 (API):     {c['api']['endpoint']} (Status: {c['api']['status']}, Framework: {c['api']['framework']})")

        assert len(history['chains']) == 2, f"Expected 2 chains, got {len(history['chains'])}"
        print("\n  [PASS] Full 4-layer provenance chain verified across Dataset -> Recipe -> Model -> API.")

        # 7. Test Atomic Rollback Action: POST /api/v1/projects/{project_id}/rollback (v2 -> v1)
        print("\n[STEP 7] Executing Instantaneous Rollback (Rollback from v2 to v1):")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        before_active = cur.execute("SELECT version, algorithm, id FROM trained_models WHERE project_id=? AND is_selected=1", (project_id,)).fetchone()
        print(f"  State BEFORE Rollback: Active Model is v{before_active[0]} ({before_active[1]}, ID: {before_active[2][:8]}...)")
        conn.close()

        rollback_res = await client.post(
            f"/api/v1/projects/{project_id}/rollback",
            json={"target_version": 1},
            headers=headers
        )
        assert rollback_res.status_code == 200
        rb_data = rollback_res.json()
        print(f"  HTTP Status: {rollback_res.status_code}")
        print(f"  Rollback Message: {rb_data['message']}")

        # Verify DB state AFTER rollback
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        after_active = cur.execute("SELECT version, algorithm, id FROM trained_models WHERE project_id=? AND is_selected=1", (project_id,)).fetchone()
        print(f"  State AFTER Rollback:  Active Model is now v{after_active[0]} ({after_active[1]}, ID: {after_active[2][:8]}...)")
        conn.close()

        assert after_active[0] == 1, f"Expected active version to be 1, got {after_active[0]}"
        print("  [PASS] Rollback successfully updated active production model to v1 without retraining.")

        # 8. Test Rollback Failure Case (Non-existent version 999)
        print("\n[STEP 8] Rollback Failure Case (Non-existent Version v999):")
        bad_rb = await client.post(
            f"/api/v1/projects/{project_id}/rollback",
            json={"target_version": 999},
            headers=headers
        )
        print(f"  HTTP Status: {bad_rb.status_code}")
        print(f"  Error Response: {bad_rb.json()}")
        assert bad_rb.status_code == 404
        print("  [PASS] Correctly returned HTTP 404 for invalid rollback target.")

        # 9. Cleanup
        print("\n[STEP 9] Cleaning Up Test Project & Artifacts:")
        await client.delete(f"/api/v1/projects/{project_id}", headers=headers)
        if os.path.exists(csv_v1): os.remove(csv_v1)
        if os.path.exists(csv_v2): os.remove(csv_v2)
        print("  Cleanup completed successfully.")

    print("\n" + "=" * 75)
    print("[RESULT] ALL TESTS PASSED: VERSION VISIBILITY & CENTRALIZED LINEAGE VERIFIED!")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(main())
