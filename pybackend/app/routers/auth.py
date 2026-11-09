from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Role, User
from ..schemas import LoginRequest, Token, UserCreate, UserRead, UserRoleUpdate
from ..security import (
    create_access_token,
    get_current_active_user,
    hash_password,
    require_admin,
    verify_password,
)
print('hello')

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    role_name = payload.role.strip().lower()
    role = db.scalar(select(Role).where(Role.name == role_name))
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Allowed roles: admin, reader",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    role_name = user.role.name if user.role else "reader"
    access_token = create_access_token(data={"sub": user.email, "role": role_name})
    return Token(access_token=access_token, token_type="bearer", role=role_name)


@router.post("/token", response_model=Token)
def login_oauth2(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    # Standard OAuth2 form uses 'username' field (which corresponds to user's email)
    user = db.scalar(select(User).where(User.email == form_data.username))
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    role_name = user.role.name if user.role else "reader"
    access_token = create_access_token(data={"sub": user.email, "role": role_name})
    return Token(access_token=access_token, token_type="bearer", role=role_name)


@router.get("/me", response_model=UserRead)
def get_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user


@router.patch("/users/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    role_name = payload.role.strip().lower()
    role = db.scalar(select(Role).where(Role.name == role_name))
    if not role:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Invalid role '{payload.role}'. Allowed roles: admin, reader",
        )

    user.role_id = role.id
    db.commit()
    db.refresh(user)
    return user
