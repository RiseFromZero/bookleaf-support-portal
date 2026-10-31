from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class BookResponse(BaseModel):
    """Serializes a Book record, gracefully handling nullable in-production fields."""
    id: int
    book_code: str
    author_id: int
    title: str
    isbn: str
    genre: str
    publication_date: Optional[str] = None
    status: str
    mrp: Optional[float] = None
    author_royalty_per_copy: Optional[float] = None
    total_copies_sold: int
    total_royalty_earned: float
    royalty_paid: float
    royalty_pending: float
    last_royalty_payout_date: Optional[str] = None
    print_partner: Optional[str] = None
    available_on: List[str] = []

    model_config = ConfigDict(from_attributes=True)