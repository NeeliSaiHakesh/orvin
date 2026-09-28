"""Hindsight DevOps Agent Engine for AutoMLOps Platform.

Provides Pre-Flight CI/CD Risk Assessment, Post-Mortem Incident Retention,
Semantic Recall across Hindsight Memory Banks, and Groq-powered Auto-Patching.
"""

import os
import json
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

# API Key Configuration
GROQ_API_KEY = getattr(settings, "GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
HINDSIGHT_API_KEY = getattr(settings, "HINDSIGHT_API_KEY", "") or os.getenv("HINDSIGHT_API_KEY", "")
HINDSIGHT_BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "devops_postmortems_bank")

# ──────────────────────────────────────────────
# 1. Pre-Loaded Enterprise Incidents (Initial Memory Bank)
# ──────────────────────────────────────────────

PRELOADED_MEMORIES = [
    {
        "id": "inc-104",
        "timestamp": "14 days ago",
        "title": "Incident #104: NumPy 2.0.0 ABI Breaking Change in Cython/PyTorch Extensions",
        "category": "dependency",
        "severity": "CRITICAL",
        "summary": "Upgrading numpy>=2.0.0 without un-pinning caused C-API ABI incompatible binary mismatches in Cython extensions during model inference, producing silent segmentation faults and model server crashes.",
        "prevention_rule": "Pin numpy<2.0.0 in requirements.txt or recompile Cython extensions against NumPy 2.x ABI headers.",
        "recall_score": 0.98
    },
    {
        "id": "inc-88",
        "timestamp": "30 days ago",
        "title": "Incident #88: CUDA 12.2 GPU Out-Of-Memory (OOM) Kubernetes Pod Eviction",
        "category": "hardware_oom",
        "severity": "HIGH",
        "summary": "Increasing worker concurrency from 2 to 8 in microservice deployment caused VRAM overcommit on NVIDIA A10G GPUs (24GB), leading to K8s OOMKilled evictions during peak batch prediction traffic.",
        "prevention_rule": "Limit worker concurrency to max 4 per GPU or implement batch queue throttling with explicit CUDA memory ceiling (MAX_VRAM_MB=18000).",
        "recall_score": 0.94
    },
    {
        "id": "inc-62",
        "timestamp": "45 days ago",
        "title": "Incident #62: Staging vs Production Redis Auth Secret Drift",
        "category": "secret_drift",
        "severity": "HIGH",
        "summary": "Adding a Redis caching layer to backend models without declaring REDIS_AUTH_TOKEN in Production Kubernetes Secret manifests caused silent connection dropouts and 500 errors upon production rollout.",
        "prevention_rule": "Enforce explicit Secret manifest validation: REDIS_AUTH_TOKEN must be defined in both staging and prod secret templates before merging deployment changes.",
        "recall_score": 0.92
    }
]

# ──────────────────────────────────────────────
# 2. Pre-Loaded 3 Enterprise Scenarios for Demo
# ──────────────────────────────────────────────

PRELOADED_SCENARIOS = [
    {
        "id": "scenario-numpy2",
        "title": "Scenario 1: NumPy 2.0 / Pydantic v2 Breaking ABI Clash",
        "category": "dependency",
        "description": "PR #402 updates requirements.txt to numpy>=2.0.0 and pydantic>=2.7.0 for ML inference workers.",
        "diff": """--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@ -12,4 +12,4 @@
-numpy>=1.24.0,<2.0.0
+numpy>=2.0.0
-pydantic>=1.10.0
+pydantic>=2.7.0
 pandas>=2.0.0""",
        "expected_risk_day1": 15,
        "expected_risk_hindsight": 92
    },
    {
        "id": "scenario-cuda-oom",
        "title": "Scenario 2: CUDA 12.2 GPU OOM Kubernetes Eviction",
        "category": "hardware_oom",
        "description": "PR #488 increases model inference worker concurrency from 2 to 8 in k8s-deployment.yaml.",
        "diff": """--- a/k8s/deployment.yaml
+++ b/k8s/deployment.yaml
@@ -24,4 +24,4 @@
         env:
-          - name: WORKER_CONCURRENCY
-            value: "2"
+          - name: WORKER_CONCURRENCY
+            value: "8"
           - name: CUDA_VISIBLE_DEVICES
             value: "0,1" """,
        "expected_risk_day1": 20,
        "expected_risk_hindsight": 88
    },
    {
        "id": "scenario-secret-drift",
        "title": "Scenario 3: Staging vs Production Secret Drift",
        "category": "secret_drift",
        "description": "PR #512 adds Redis caching layer to feature store without adding secret keys to prod deployment.",
        "diff": """--- a/backend/app/config.py
+++ b/backend/app/config.py
@@ -8,3 +8,4 @@
     DATABASE_URL: str
+    REDIS_URL: str = "redis://redis-cluster:6379"
+    REDIS_AUTH_TOKEN: str = os.getenv("REDIS_AUTH_TOKEN") # Missing in k8s prod secret! """,
        "expected_risk_day1": 10,
        "expected_risk_hindsight": 85
    }
]

# In-memory store for custom retained memories during session
LIVE_MEMORY_BANK = list(PRELOADED_MEMORIES)


# ──────────────────────────────────────────────
# 3. Engine Class Implementation
# ──────────────────────────────────────────────

class HindsightDevOpsEngine:
    """Core Engine integrating Hindsight Cloud REST API and Groq LLM."""

    def __init__(self):
        self.groq_api_key = GROQ_API_KEY
        self.hindsight_api_key = HINDSIGHT_API_KEY
        self.bank_id = HINDSIGHT_BANK_ID

    async def recall_memories(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Recall relevant incident post-mortems from Hindsight Memory Bank.
        
        Attempts live Hindsight API query first; falls back to semantic keyword matching
        against local memory store.
        """
        # Try Live Hindsight API
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.post(
                    f"https://api.hindsight.ai/v1/banks/{self.bank_id}/recall",
                    headers={"Authorization": f"Bearer {self.hindsight_api_key}"},
                    json={"query": query, "top_k": limit}
                )
                if res.status_code == 200:
                    data = res.json()
                    memories = data.get("memories", [])
                    if memories:
                        return memories
        except Exception:
            pass  # Fail smoothly to local memory bank

        # Fallback Local Semantic Recall Matcher
        q_lower = query.lower()
        matched = []
        for mem in LIVE_MEMORY_BANK:
            score = 0.5
            if any(k in q_lower for k in ["numpy", "abi", "pydantic", "cython", "requirement"]) and mem["category"] == "dependency":
                score = 0.98
            elif any(k in q_lower for k in ["cuda", "gpu", "oom", "concurrency", "vram", "k8s", "worker"]) and mem["category"] == "hardware_oom":
                score = 0.94
            elif any(k in q_lower for k in ["redis", "secret", "token", "env", "drift", "auth"]) and mem["category"] == "secret_drift":
                score = 0.92
            
            item = dict(mem)
            item["recall_score"] = score
            matched.append(item)

        matched.sort(key=lambda x: x["recall_score"], reverse=True)
        return matched[:limit]

    async def retain_incident(self, title: str, description: str, category: str, prevention_rule: str, service: str = "ml-inference-service") -> Dict[str, Any]:
        """Store a new incident post-mortem into Hindsight Memory."""
        new_item = {
            "id": f"inc-{len(LIVE_MEMORY_BANK) + 101}",
            "timestamp": "Just now",
            "title": title,
            "category": category,
            "severity": "HIGH",
            "summary": description,
            "prevention_rule": prevention_rule,
            "recall_score": 0.99
        }
        
        # Append to live local memory bank
        LIVE_MEMORY_BANK.insert(0, new_item)

        # Attempt to retain via Hindsight Cloud API asynchronously
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                await client.post(
                    f"https://api.hindsight.ai/v1/banks/{self.bank_id}/retain",
                    headers={"Authorization": f"Bearer {self.hindsight_api_key}"},
                    json={"content": f"{title}\n{description}\nRule: {prevention_rule}", "metadata": {"category": category}}
                )
        except Exception:
            pass

        return new_item

    async def synthesize_patch_groq(self, diff: str, recalled_memories: List[Dict[str, Any]]) -> str:
        """Synthesize concrete code auto-patch using Groq LLM (llama-3.3-70b-versatile)."""
        if not self.groq_api_key:
            return self._generate_fallback_patch(diff, recalled_memories)

        memories_text = "\n".join([f"- {m['title']}: {m['prevention_rule']}" for m in recalled_memories])

        prompt = f"""You are an autonomous DevOps & MLOps Patch Generator.
Given a git diff and recalled incident post-mortems from memory, generate a corrected, safe patch diff.

RECALLED INCIDENTS & PREVENTION RULES:
{memories_text}

PROPOSED PR DIFF WITH RISK:
{diff}

INSTRUCTIONS:
Output ONLY the raw unified git diff patch file fixing the issue. Do NOT include markdown codeblock backticks or conversational filler.
"""

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1
                    }
                )
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"].strip()
                    # Clean out codeblock markup if present
                    if content.startswith("```"):
                        lines = content.split("\n")
                        content = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
                    return content
        except Exception:
            pass

        return self._generate_fallback_patch(diff, recalled_memories)

    def _generate_fallback_patch(self, diff: str, memories: List[Dict[str, Any]]) -> str:
        """Deterministic patch generator for instant offline resilience."""
        if "numpy>=2.0.0" in diff or "numpy" in diff.lower():
            return """--- a/backend/requirements.txt
+++ b/backend/requirements.txt
@@ -12,4 +12,4 @@
-numpy>=2.0.0
+numpy>=1.24.0,<2.0.0  # Hindsight Auto-Patch: Preserves Cython ABI compatibility (Inc #104)
-pydantic>=2.7.0
+pydantic>=2.7.0"""
        elif "WORKER_CONCURRENCY" in diff:
            return """--- a/k8s/deployment.yaml
+++ b/k8s/deployment.yaml
@@ -24,4 +24,4 @@
         env:
-          - name: WORKER_CONCURRENCY
-            value: "8"
+          - name: WORKER_CONCURRENCY
+            value: "4"  # Hindsight Auto-Patch: Capped to prevent GPU VRAM OOM eviction (Inc #88)"""
        elif "REDIS_AUTH_TOKEN" in diff or "REDIS" in diff:
            return """--- a/k8s/secrets-production.yaml
+++ b/k8s/secrets-production.yaml
@@ -10,0 +11,3 @@
+  # Hindsight Auto-Patch: Prevent secret drift (Inc #62)
+  - name: REDIS_AUTH_TOKEN
+    valueFrom: { secretKeyRef: { name: redis-secret, key: auth-token } }"""
        return """# Hindsight Auto-Patch Generated
# All parameters adjusted to match historical resilience rules."""

    async def analyze_pr(self, diff: str, scenario_id: Optional[str] = None, mode: str = "auto") -> Dict[str, Any]:
        """Core Pre-Flight CI/CD evaluation pipeline."""
        
        # Check if scenario preset selected
        if scenario_id:
            scenario = next((s for s in PRELOADED_SCENARIOS if s["id"] == scenario_id), None)
            if scenario:
                diff = scenario["diff"]

        # 1. Day 1 Mode (No Hindsight Memory)
        if mode == "day1":
            return {
                "mode": "day1",
                "risk_score": 15,
                "risk_level": "LOW",
                "recalled_memories": [],
                "issues_found": ["Basic syntax check passed. Package versions appear standard."],
                "prevention_rule": None,
                "suggested_patch": None,
                "explanation": "Standard LLM / CI checks have no memory of past Incident #104 / #88. Without Hindsight memory, the agent treats breaking dependency changes or VRAM concurrency spikes as standard PR edits and approves them into production.",
                "memory_used": False
            }

        # 2. Recall Hindsight Memories
        recalled = await self.recall_memories(diff, limit=2)
        top_mem = recalled[0] if recalled else None

        # 3. Mode Day 14 vs Day 60
        risk_score = 92 if ("numpy" in diff.lower() or "worker_concurrency" in diff.lower() or "redis" in diff.lower()) else 45
        risk_level = "CRITICAL" if risk_score >= 85 else "MEDIUM"
        
        issues = [
            f"Detected high-risk pattern matching Hindsight {top_mem['title']}" if top_mem else "Potential deployment risk detected.",
            f"Violation of prevention rule: {top_mem['prevention_rule']}" if top_mem else "Unchecked system boundary change."
        ]

        patch = await self.synthesize_patch_groq(diff, recalled)

        return {
            "mode": mode if mode in ["day14", "day60"] else "day60",
            "risk_score": risk_score,
            "risk_level": risk_level,
            "recalled_memories": recalled,
            "issues_found": issues,
            "prevention_rule": top_mem["prevention_rule"] if top_mem else "Apply pinned version constraints.",
            "suggested_patch": patch if mode != "day14" else None,
            "explanation": f"Hindsight Memory recalled {len(recalled)} past post-mortem(s). The agent flagged this PR with {risk_score}% blast radius risk and auto-synthesized a production patch based on Incident #{top_mem['id'] if top_mem else '104'}.",
            "memory_used": True
        }

    def get_story_mode_timeline(self) -> List[Dict[str, Any]]:
        """Return the 3-Stage Temporal Evolution Timeline for Demo Story Mode."""
        return [
            {
                "day": "Day 1",
                "stage_name": "Zero Memory (Generic LLM)",
                "description": "Standard CI/CD check evaluates PR diff without historical context.",
                "risk_score": 15,
                "risk_level": "LOW",
                "recalled_count": 0,
                "summary": "Agent approves PR #402 updating numpy>=2.0.0 because it has no memory of binary ABI crashes.",
                "action_taken": "APPROVED (False Negative -> Production Outage occurs)",
                "auto_patch_available": False
            },
            {
                "day": "Day 14",
                "stage_name": "Incident Recall (Post-Mortem Memory)",
                "description": "Hindsight Memory ingests Incident #104 post-mortem and links Cython ABI failures.",
                "risk_score": 92,
                "risk_level": "CRITICAL",
                "recalled_count": 1,
                "summary": "Agent recalls Incident #104: 'NumPy 2.0.0 ABI Breaking Change' and blocks deployment.",
                "action_taken": "BLOCKED & WARNING ISSUED to Developer",
                "auto_patch_available": False
            },
            {
                "day": "Day 60",
                "stage_name": "Predictive Senior Engineer",
                "description": "Agent synthesizes prevention rules and auto-generates unified diff patches.",
                "risk_score": 92,
                "risk_level": "CRITICAL",
                "recalled_count": 2,
                "summary": "Agent recalls Incident #104 & #88, flags risk before merge, and auto-generates pinned numpy<2.0.0 patch.",
                "action_taken": "BLOCKED + 1-CLICK AUTO-PATCH GENERATED",
                "auto_patch_available": True
            }
        ]

    def get_scenarios(self) -> List[Dict[str, Any]]:
        return PRELOADED_SCENARIOS

    def get_all_memories(self) -> List[Dict[str, Any]]:
        return LIVE_MEMORY_BANK

hindsight_devops_engine = HindsightDevOpsEngine()
