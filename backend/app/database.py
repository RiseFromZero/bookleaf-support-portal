from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Normalize cloud Postgres URLs if deployed to Render/Neon later
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SQLite requires check_same_thread=False for FastAPI multi-threaded requests
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

# Create the SQLAlchemy database engine
engine = create_engine(db_url, connect_args=connect_args)

# Factory for creating isolated database sessions per API request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class that all our database models (User, Book, Ticket) will inherit from
Base = declarative_base()


def get_db():
    """
    FastAPI Dependency that provides a database session for a single request
    and guarantees the connection is closed afterward.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()