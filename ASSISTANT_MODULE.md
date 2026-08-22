# Module 10: AI MLOps Assistant

> Conversational assistant grounded in real project data — never hallucinates metrics.

---

## How Context Grounding Works

The assistant answers are **always grounded in real computed data** from your project. Here's the flow:

```
User asks a question
        │
        ▼
┌─────────────────────────┐
│  build_context_payload() │  ← Queries DB for leaderboard, SHAP,
│                         │    cleaning report, dataset stats
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Context Payload (dict) │  ← Real numbers from your project
│  • best model + metrics │
│  • feature importances  │
│  • cleaning steps       │
│  • dataset shape        │
└──────────┬──────────────┘
           │
     ┌─────┴──────┐
     │             │
     ▼             ▼
┌──────────┐  ┌───────────┐
│  Gemini  │  │ Fallback  │
│ 2.5 Flash│  │ Templates │
│          │  │           │
│ Prompt:  │  │ Pure f-   │
│ "ONLY    │  │ string    │
│ reference│  │ from same │
│ numbers  │  │ context   │
│ in the   │  │ dict      │
│ CONTEXT" │  │           │
└────┬─────┘  └─────┬─────┘
     │              │
     └──────┬───────┘
            │
            ▼
  Response + grounded_context
  (echoes which data was used)
```

### Key Guarantees

1. **The Gemini prompt** includes an explicit instruction: *"ONLY reference numbers and facts present in the CONTEXT below. Never invent or estimate metrics."*

2. **The fallback engine** uses Python f-strings that directly read values from the same context dict — it is structurally impossible for it to reference data that doesn't exist.

3. **The `grounded_context` field** in every API response echoes back the best model name, metrics, top features, and dataset shape, so the frontend can display *"Grounded in: RandomForest, accuracy=0.92, top feature: income"*.

---

## Getting a GEMINI_API_KEY (Free)

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **"Get API Key"** → **"Create API Key"**
4. Copy the key

### Setting the Key

Add it to your `.env` file in the project root:

```env
GEMINI_API_KEY=AIzaSy...your-key-here
```

The key is read by `app/config.py` via `pydantic-settings` and passed to the Gemini SDK at runtime. **Never commit the key to version control.**

---

## Fallback Behavior (No API Key / Offline)

If `GEMINI_API_KEY` is empty or the Gemini API call fails for any reason (rate limit, timeout, network error), the assistant automatically falls back to a **deterministic template engine** that:

- Inspects the user's question for keywords (best model, features, cleaning, dataset, etc.)
- Constructs a structured answer using only values from the context payload
- **Never throws** — there is a last-resort catch-all that returns a generic helpful message

This means the assistant works perfectly in live demos even with zero internet access.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/projects/{id}/assistant/ask` | Ask a question (body: `{"question": "..."}`) |
| `GET` | `/api/v1/projects/{id}/assistant/suggestions` | Get 3-4 dynamic suggested questions |

### Response Format

```json
{
  "answer": "Your best model is RandomForest with accuracy = 0.92...",
  "source": "gemini",
  "grounded_context": {
    "best_model": "RandomForest",
    "task_type": "classification",
    "primary_metrics": {"accuracy": 0.9234, "f1": 0.8901},
    "top_features": ["income", "age", "tenure"],
    "dataset_shape": "5000 × 12"
  }
}
```

---

## Files Added / Modified

### New Files
| File | Description |
|------|-------------|
| `backend/app/engines/mlops_assistant.py` | Context builder, Gemini caller, fallback engine, suggestion generator |
| `backend/app/routers/assistant.py` | `/ask` and `/suggestions` endpoints |
| `backend/app/schemas/assistant.py` | Pydantic request/response models |
| `frontend/src/app/projects/[id]/assistant/page.tsx` | Chat UI with grounded-in captions |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/main.py` | Added assistant router |
| `backend/app/config.py` | Added `GEMINI_API_KEY` field |
| `backend/requirements.txt` | Added `google-genai` |
| `.env.example` | Added `GEMINI_API_KEY` |
| `frontend/src/lib/api.ts` | Added `assistant` API namespace |
| `frontend/src/components/layout/Sidebar.tsx` | Added Assistant nav link |
