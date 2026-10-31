from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.auth import UserResponse
from app.schemas.book import BookResponse

# Strict Literal types matching the BookLeaf Assignment Specification
TicketStatusType = Literal["Open", "In Progress", "Resolved", "Closed"]

TicketCategoryType = Literal[
    "Royalty & Payments",
    "ISBN & Metadata Issues",
    "Printing & Quality",
    "Distribution & Availability",
    "Book Status & Production Updates",
    "General Inquiry",
]

TicketPriorityType = Literal["Critical", "High", "Medium", "Low"]


class TicketCreateRequest(BaseModel):
    """Payload sent by an Author when raising a new support query."""
    book_id: Optional[int] = None  # None = "General / Account Level"
    subject: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000)
    attachment_name: Optional[str] = None


class TicketAdminUpdateRequest(BaseModel):
    """Payload sent by an Admin to update status, assign ticket, or override AI fields."""
    status: Optional[TicketStatusType] = None
    category: Optional[TicketCategoryType] = None
    priority: Optional[TicketPriorityType] = None
    assigned_admin_id: Optional[int] = None
    ai_draft_response: Optional[str] = None


class MessageCreateRequest(BaseModel):
    """Payload for adding a public reply or an Admin-only internal note."""
    content: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: int
    content: str
    is_internal: bool
    created_at: datetime
    sender: UserResponse

    model_config = ConfigDict(from_attributes=True)


class TicketResponse(BaseModel):
    id: int
    author_id: int
    book_id: Optional[int] = None
    subject: str
    description: str
    attachment_name: Optional[str] = None
    status: str
    category: str
    priority: str
    ai_draft_response: Optional[str] = None
    ai_reasoning: Optional[str] = None
    ai_classified: bool
    is_category_overridden: bool
    is_priority_overridden: bool
    assigned_admin_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Nested relationships for rich UI rendering
    author: UserResponse
    book: Optional[BookResponse] = None
    assigned_admin: Optional[UserResponse] = None
    messages: List[TicketMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)