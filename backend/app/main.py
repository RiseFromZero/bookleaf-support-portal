from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.seed import seed_database
from app.routers import auth, books, tickets


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(
    title="BookLeaf Publishing — Author Support & Communication Portal API",
    description=(
        "REST API powering the BookLeaf Author Portal and Admin Operations Portal "
        "with Gemini AI auto-classification, priority scoring, and Knowledge-Base-grounded response drafting."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Ensure tables and seed data exist on serverless environments (like Vercel)
Base.metadata.create_all(bind=engine)
seed_database()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(tickets.router)


@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "BookLeaf Author Support API",
        "version": "1.0.0",
    }