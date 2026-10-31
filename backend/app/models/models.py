from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Text,
    ForeignKey,
    DateTime,
    JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    """Returns current UTC timestamp for created_at / updated_at columns."""
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    author_code = Column(String, unique=True, nullable=True, index=True)  # e.g., AUTH001 (Null for admins)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="author", nullable=False)  # "author" or "admin"
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    joined_date = Column(String, nullable=True)

    # Relationships
    books = relationship("Book", back_populates="author", cascade="all, delete-orphan")
    tickets = relationship(
        "Ticket",
        foreign_keys="Ticket.author_id",
        back_populates="author",
        cascade="all, delete-orphan",
    )


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    book_code = Column(String, unique=True, index=True, nullable=False)  # e.g., BK001
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    isbn = Column(String, nullable=False)
    genre = Column(String, nullable=False)

    # Nullable fields to gracefully support books in production (BK013, BK015)
    publication_date = Column(String, nullable=True)
    status = Column(String, nullable=False)
    mrp = Column(Float, nullable=True)
    author_royalty_per_copy = Column(Float, nullable=True)

    # Sales & Royalty Ledger
    total_copies_sold = Column(Integer, default=0, nullable=False)
    total_royalty_earned = Column(Float, default=0.0, nullable=False)
    royalty_paid = Column(Float, default=0.0, nullable=False)
    royalty_pending = Column(Float, default=0.0, nullable=False)
    last_royalty_payout_date = Column(String, nullable=True)

    # Production & Distribution
    print_partner = Column(String, nullable=True)
    available_on = Column(JSON, default=list, nullable=False)

    # Relationships
    author = relationship("User", back_populates="books")
    tickets = relationship("Ticket", back_populates="book")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # Nullable: Null represents "General / Account Level" inquiry
    book_id = Column(Integer, ForeignKey("books.id"), nullable=True, index=True)

    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    attachment_name = Column(String, nullable=True)  # Optional UI attachment metadata

    # Lifecycle Status: Open | In Progress | Resolved | Closed
    status = Column(String, default="Open", nullable=False, index=True)

    # AI Triage & Draft Generation Fields
    category = Column(String, default="General Inquiry", nullable=False, index=True)
    priority = Column(String, default="Medium", nullable=False, index=True)
    ai_draft_response = Column(Text, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    ai_classified = Column(Boolean, default=False, nullable=False)

    # Admin Override Tracking
    is_category_overridden = Column(Boolean, default=False, nullable=False)
    is_priority_overridden = Column(Boolean, default=False, nullable=False)

    # Ticket Ownership & Timestamps
    assigned_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships (Explicit foreign_keys used because Ticket links to User twice)
    author = relationship("User", foreign_keys=[author_id], back_populates="tickets")
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    book = relationship("Book", back_populates="tickets")
    messages = relationship(
        "TicketMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketMessage.created_at",
    )


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)

    # True = Internal Admin Note (hidden from Author API responses)
    # False = Public Reply (visible to both Author and Admin in real time)
    is_internal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")