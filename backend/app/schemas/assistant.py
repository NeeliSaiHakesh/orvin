from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class AssistantQuestion(BaseModel):
    question: str


class AssistantResponse(BaseModel):
    answer: str
    source: str  # "gemini" or "fallback"
    grounded_context: Dict[str, Any]


class SuggestionsResponse(BaseModel):
    suggestions: List[str]
