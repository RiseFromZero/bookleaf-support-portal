from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.middleware.auth_deps import (
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates an Author or Admin via email and password and returns a JWT Bearer token.
    """
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently authenticated Author or Admin."""
    return current_user


@router.get("/admins", response_model=List[UserResponse])
def list_admins(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Returns all Admin users so tickets can be assigned in the Admin Portal."""
    return db.query(User).filter(User.role == "admin").all()