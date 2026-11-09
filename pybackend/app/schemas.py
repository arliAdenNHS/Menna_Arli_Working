from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="reader", description="User role: 'reader' or 'admin'")


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    is_active: bool
    role: RoleRead | None = None
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: str = Field(description="Role name: 'admin' or 'reader'")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str | None = None


class TokenData(BaseModel):
    email: str | None = None
    role: str | None = None


# --- Book & Review Schemas ---


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5, description="Vote rating from 1 to 5")
    comment: str = Field(min_length=3, max_length=3000, description="Review text")
    reviewer_name: str | None = Field(default=None, max_length=100)


class ReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    book_slug: str
    reviewer_name: str
    rating: int
    comment: str
    created_at: datetime


class BookSimilar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    author: str
    category: str
    score: float
    cover_image_url: str | None = None


class BookRankingsMetadata(BaseModel):
    category: str
    rank: int
    total_in_category: int


class BookDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    author: str
    category: str
    description: str | None = None
    cover_image_url: str | None = None
    score: float
    confidence: float
    rankings: BookRankingsMetadata
    identifiers: dict[str, Any] = Field(default_factory=dict)
    similar_books: list[BookSimilar] = Field(default_factory=list)
    reviews: list[ReviewRead] = Field(default_factory=list)
    created_at: datetime


class RankedBookItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rank: int
    id: int
    slug: str
    title: str
    author: str
    category: str
    score: float
    confidence: float
    cover_image_url: str | None = None
    identifiers: dict[str, Any] = Field(default_factory=dict)
    review_count: int = 0


class RankingResponse(BaseModel):
    category: str
    total: int
    books: list[RankedBookItem]
