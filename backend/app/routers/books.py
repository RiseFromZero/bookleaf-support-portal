from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, Book
from app.schemas.book import BookResponse
from app.middleware.auth_deps import get_current_user

router = APIRouter(prefix="/api/books", tags=["Books"])


@router.get("", response_model=List[BookResponse])
def get_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-Based Book Listing:
    - Authors only receive their own books.
    - Admins receive all books across the catalog.
    """
    if current_user.role == "admin":
        return db.query(Book).order_by(Book.book_code.asc()).all()

    return (
        db.query(Book)
        .filter(Book.author_id == current_user.id)
        .order_by(Book.book_code.asc())
        .all()
    )