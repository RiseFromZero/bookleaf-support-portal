import json
import logging
import re
from typing import Optional, List, Dict, Any
from openai import OpenAI

from app.config import settings
from app.models.models import User, Book
from app.services.knowledge_base import (
    BOOKLEAF_SYSTEM_PROMPT,
    VALID_CATEGORIES,
    VALID_PRIORITIES,
    build_ticket_user_prompt,
)

logger = logging.getLogger(__name__)


def clean_json_string(raw_text: str) -> str:
    """
    Strips markdown code fences (```json ... ```) if the LLM includes them
    around the JSON response.
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def heuristic_fallback_classification(subject: str, description: str) -> Dict[str, Any]:
    """
    Graceful Degradation Fallback (Section D.3):
    If the external AI API is down, rate-limited, or unconfigured, this rule-based
    fallback ensures tickets are still created and sensibly categorized without crashing.
    """
    text = f"{subject} {description}".lower()

    category = "General Inquiry"
    priority = "Medium"

    if any(k in text for k in ["royalty", "payment", "payout", "paid", "money", "bank", "₹"]):
        category = "Royalty & Payments"
        priority = "High" if any(u in text for u in ["months", "overdue", "still haven't", "0"]) else "Medium"
    elif any(k in text for k in ["isbn", "barcode", "metadata", "description"]):
        category = "ISBN & Metadata Issues"
        priority = "High" if "isbn" in text else "Low"
    elif any(k in text for k in ["print", "quality", "blurry", "binding", "defect", "damaged", "pages"]):
        category = "Printing & Quality"
        priority = "High"
    elif any(k in text for k in ["amazon", "flipkart", "unavailable", "stock", "store", "distribution"]):
        category = "Distribution & Availability"
        priority = "Medium"
    elif any(k in text for k in ["typesetting", "cover", "production", "proof", "stage", "status", "live"]):
        category = "Book Status & Production Updates"
        priority = "Medium"

    return {
        "category": category,
        "priority": priority,
        "ai_reasoning": "AI API unavailable or unconfigured — classified via fallback heuristic rules. Manual draft required.",
        "ai_draft_response": None,
        "ai_classified": False,
    }


def analyze_ticket_with_ai(
    author: User,
    selected_book: Optional[Book],
    all_author_books: List[Book],
    subject: str,
    description: str,
) -> Dict[str, Any]:
    """
    Single-call AI Triage & Response Generator (Supports Google Gemini, OpenAI, or Groq).
    Returns dict with keys: category, priority, ai_reasoning, ai_draft_response, ai_classified.
    """
    api_key = (settings.LLM_API_KEY or "").strip()
    if not api_key or api_key.startswith("your_") or "PASTE_YOUR" in api_key:
        logger.warning("LLM_API_KEY not configured in .env. Using graceful fallback.")
        return heuristic_fallback_classification(subject, description)

    user_prompt = build_ticket_user_prompt(
        author=author,
        selected_book=selected_book,
        all_author_books=all_author_books,
        subject=subject,
        description=description,
    )

    try:
        client = OpenAI(
            api_key=api_key,
            base_url=settings.LLM_BASE_URL,
            timeout=15.0,
        )

        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": BOOKLEAF_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        raw_content = response.choices[0].message.content or "{}"
        parsed = json.loads(clean_json_string(raw_content))

        category = parsed.get("category", "General Inquiry")
        if category not in VALID_CATEGORIES:
            category = "General Inquiry"

        priority = parsed.get("priority", "Medium")
        if priority not in VALID_PRIORITIES:
            priority = "Medium"

        draft_response = parsed.get("draft_response") or parsed.get("ai_draft_response")
        reasoning = parsed.get("reasoning") or "Classified and drafted by BookLeaf Gemini AI Engine."

        return {
            "category": category,
            "priority": priority,
            "ai_reasoning": reasoning,
            "ai_draft_response": draft_response,
            "ai_classified": True if draft_response else False,
        }

    except Exception as exc:
        logger.error(f"AI Service Error (degrading gracefully): {exc}")
        return heuristic_fallback_classification(subject, description)