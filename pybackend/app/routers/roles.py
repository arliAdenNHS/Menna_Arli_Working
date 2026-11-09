from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Role
from ..schemas import RoleRead

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(db: Session = Depends(get_db)):
    """List all available roles (admin, reader)."""
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.get("/{role_name_or_id}", response_model=RoleRead)
def get_role(role_name_or_id: str, db: Session = Depends(get_db)):
    """Get details for a specific role by ID or by name."""
    if role_name_or_id.isdigit():
        role = db.get(Role, int(role_name_or_id))
    else:
        role = db.scalar(select(Role).where(Role.name == role_name_or_id.lower()))

    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Role '{role_name_or_id}' not found")
    return role
