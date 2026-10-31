from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, Book, Ticket, TicketMessage
from app.schemas.ticket import (
    TicketCreateRequest,
    TicketAdminUpdateRequest,
    MessageCreateRequest,
    TicketResponse,
    TicketMessageResponse,
)
from app.middleware.auth_deps import get_current_user, require_admin
from app.services.ai_service import analyze_ticket_with_ai

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


def sanitize_ticket_for_user(ticket: Ticket, current_user: User) -> TicketResponse:
    """
    Converts a SQLAlchemy Ticket into a TicketResponse and strips Admin-only fields
    (internal notes and unapproved AI drafts) when accessed by an Author.
    """
    resp = TicketResponse.model_validate(ticket)
    if current_user.role != "admin":
        resp.messages = [m for m in resp.messages if not m.is_internal]
        resp.ai_draft_response = None
        resp.ai_reasoning = None
    return resp


@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: TicketCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Author submits a new support query.
    Automatically runs AI classification, priority scoring, and response drafting.
    """
    selected_book: Optional[Book] = None
    if payload.book_id is not None:
        selected_book = (
            db.query(Book)
            .filter(Book.id == payload.book_id, Book.author_id == current_user.id)
            .first()
        )
        if not selected_book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected book not found or does not belong to your account",
            )

    all_author_books = (
        db.query(Book).filter(Book.author_id == current_user.id).all()
    )

    # Run Single-Call AI Triage & Draft Generation (with automatic graceful fallback)
    ai_result = analyze_ticket_with_ai(
        author=current_user,
        selected_book=selected_book,
        all_author_books=all_author_books,
        subject=payload.subject,
        description=payload.description,
    )

    new_ticket = Ticket(
        author_id=current_user.id,
        book_id=selected_book.id if selected_book else None,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        attachment_name=payload.attachment_name,
        status="Open",
        category=ai_result["category"],
        priority=ai_result["priority"],
        ai_draft_response=ai_result["ai_draft_response"],
        ai_reasoning=ai_result["ai_reasoning"],
        ai_classified=ai_result["ai_classified"],
    )

    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return sanitize_ticket_for_user(new_ticket, current_user)


@router.get("", response_model=List[TicketResponse])
def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    date_sort: str = Query("newest", pattern="^(newest|oldest)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists support tickets:
    - Authors only see their own tickets.
    - Admins see all tickets across all authors with filtering by status, category, priority, and date.
    """
    query = db.query(Ticket)

    # Enforce Role-Based Access Control
    if current_user.role != "admin":
        query = query.filter(Ticket.author_id == current_user.id)

    # Optional Filters
    if status_filter and status_filter != "All":
        query = query.filter(Ticket.status == status_filter)
    if category and category != "All":
        query = query.filter(Ticket.category == category)
    if priority and priority != "All":
        query = query.filter(Ticket.priority == priority)

    # Date ordering ("oldest" helps admins spot oldest unresolved tickets)
    if date_sort == "oldest":
        query = query.order_by(Ticket.created_at.asc())
    else:
        query = query.order_by(Ticket.created_at.desc())

    tickets = query.all()
    return [sanitize_ticket_for_user(t, current_user) for t in tickets]


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket_detail(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetches a single ticket and its conversation thread."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )

    if current_user.role != "admin" and ticket.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this ticket",
        )

    return sanitize_ticket_for_user(ticket, current_user)


@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket_admin(
    ticket_id: int,
    payload: TicketAdminUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Admin-only endpoint to update ticket status, assign ticket ownership,
    edit the AI draft, or override the AI's category and priority classification.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )

    if payload.status is not None:
        ticket.status = payload.status

    if payload.category is not None and payload.category != ticket.category:
        ticket.category = payload.category
        ticket.is_category_overridden = True

    if payload.priority is not None and payload.priority != ticket.priority:
        ticket.priority = payload.priority
        ticket.is_priority_overridden = True

    if payload.assigned_admin_id is not None:
        # Allow passing 0 or negative to unassign, otherwise verify admin exists
        if payload.assigned_admin_id <= 0:
            ticket.assigned_admin_id = None
        else:
            target_admin = (
                db.query(User)
                .filter(User.id == payload.assigned_admin_id, User.role == "admin")
                .first()
            )
            if not target_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid admin user ID for assignment",
                )
            ticket.assigned_admin_id = target_admin.id

    if payload.ai_draft_response is not None:
        ticket.ai_draft_response = payload.ai_draft_response

    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return sanitize_ticket_for_user(ticket, admin_user)


@router.post(
    "/{ticket_id}/messages",
    response_model=TicketMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_ticket_message(
    ticket_id: int,
    payload: MessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Adds a public reply (Author or Admin) or an internal note (Admin only).
    When an Admin sends a public reply to an Open ticket, automatically moves status to 'In Progress'.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )

    if current_user.role != "admin" and ticket.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot post messages to another author's ticket",
        )

    # Authors can never create internal admin notes
    is_internal = payload.is_internal if current_user.role == "admin" else False

    new_message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        content=payload.content.strip(),
        is_internal=is_internal,
    )
    db.add(new_message)

    # Auto-progress ticket workflow when Admin sends a public response
    if current_user.role == "admin" and not is_internal:
        if ticket.status == "Open":
            ticket.status = "In Progress"
        if ticket.assigned_admin_id is None:
            ticket.assigned_admin_id = current_user.id

    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(new_message)
    return new_message


@router.post("/{ticket_id}/regenerate-ai", response_model=TicketResponse)
def regenerate_ai_draft(
    ticket_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Admin-only endpoint to re-run the AI classification and draft generator
    (useful if the AI API was temporarily rate-limited or Admin wants a fresh draft).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )

    all_author_books = (
        db.query(Book).filter(Book.author_id == ticket.author_id).all()
    )

    ai_result = analyze_ticket_with_ai(
        author=ticket.author,
        selected_book=ticket.book,
        all_author_books=all_author_books,
        subject=ticket.subject,
        description=ticket.description,
    )

    # Preserve admin overrides if they already manually set category or priority
    if not ticket.is_category_overridden:
        ticket.category = ai_result["category"]
    if not ticket.is_priority_overridden:
        ticket.priority = ai_result["priority"]

    ticket.ai_draft_response = ai_result["ai_draft_response"]
    ticket.ai_reasoning = ai_result["ai_reasoning"]
    ticket.ai_classified = ai_result["ai_classified"]
    ticket.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(ticket)
    return sanitize_ticket_for_user(ticket, admin_user)