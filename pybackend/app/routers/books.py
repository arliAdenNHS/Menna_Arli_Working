# from typing import Annotated

# from fastapi import APIRouter, Depends, HTTPException, status
# from fastapi.responses import JSONResponse
# from fastapi.security import OAuth2PasswordBearer
# import httpx
# from sqlalchemy import select
# from sqlalchemy.orm import Session

# from ..db import get_db
# from ..models import Review, User
# from ..schemas import ReviewCreate, ReviewRead
# from ..security import decode_access_token

# router = APIRouter(prefix="/v1", tags=["books"])

# OPENBOOKRANK_BASE_URL = "https://openbookrank.com/api/v1"
# oauth2_optional_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


# def get_optional_user(
#     token: Annotated[str | None, Depends(oauth2_optional_scheme)] = None,
#     db: Session = Depends(get_db),
# ) -> User | None:
#     if not token:
#         return None
#     payload = decode_access_token(token)
#     if not payload:
#         return None
#     email = payload.get("sub")
#     if not email:
#         return None
#     return db.scalar(select(User).where(User.email == email))


# # 1. Book endpoint — /api/v1/books/{slug}.json
# @router.get("/books/{slug}.json")
# @router.get("/books/{slug}", include_in_schema=False)
# async def get_book_by_slug(slug: str, db: Session = Depends(get_db)):
#     """Fetch book data from external openbookrank API and merge with local reviews."""
#     clean_slug = slug.removesuffix(".json").strip().lower()

#     # Fetch book data from external API
#     async with httpx.AsyncClient(timeout=12.0) as client:
#         try:
#             ext_response = await client.get(f"{OPENBOOKRANK_BASE_URL}/books/{clean_slug}.json")
#         except httpx.RequestError as exc:
#             raise HTTPException(
#                 status_code=status.HTTP_502_BAD_GATEWAY,
#                 detail=f"Error connecting to external OpenBookRank API: {exc}",
#             )

#     if ext_response.status_code == 404:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Book '{clean_slug}' not found on OpenBookRank.",
#         )
#     if ext_response.status_code != 200:
#         raise HTTPException(
#             status_code=ext_response.status_code,
#             detail=f"OpenBookRank API error: {ext_response.text}",
#         )

#     book_data = ext_response.json()

#     # Query local reviews from database for this book
#     local_reviews = db.scalars(
#         select(Review).where(Review.book_slug == clean_slug).order_by(Review.created_at.desc())
#     ).all()

#     reviews_list = [
#         {
#             "id": r.id,
#             "book_slug": r.book_slug,
#             "reviewer_name": r.reviewer_name,
#             "rating": r.rating,
#             "comment": r.comment,
#             "created_at": r.created_at.isoformat() if r.created_at else None,
#         }
#         for r in local_reviews
#     ]

#     # Attach local reviews to book response
#     book_data["reviews"] = reviews_list
#     book_data["local_reviews_count"] = len(reviews_list)
#     if reviews_list:
#         book_data["local_average_score"] = round(
#             sum(r["rating"] for r in reviews_list) / len(reviews_list), 2
#         )
#     else:
#         book_data["local_average_score"] = None

#     return JSONResponse(content=book_data)


# # 2. Ranking endpoint — /api/v1/rankings/{category}.json
# @router.get("/rankings/{category}.json")
# @router.get("/rankings/{category}", include_in_schema=False)
# async def get_rankings_by_category(category: str):
#     """Fetch category rankings from external openbookrank API."""
#     clean_cat = category.removesuffix(".json").strip().lower()

#     async with httpx.AsyncClient(timeout=12.0) as client:
#         try:
#             ext_response = await client.get(f"{OPENBOOKRANK_BASE_URL}/rankings/{clean_cat}.json")
#         except httpx.RequestError as exc:
#             raise HTTPException(
#                 status_code=status.HTTP_502_BAD_GATEWAY,
#                 detail=f"Error connecting to external OpenBookRank API: {exc}",
#             )

#     if ext_response.status_code == 404:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Category '{clean_cat}' not found on OpenBookRank.",
#         )
#     if ext_response.status_code != 200:
#         raise HTTPException(
#             status_code=ext_response.status_code,
#             detail=f"OpenBookRank API error: {ext_response.text}",
#         )

#     ranking_data = ext_response.json()

#     # Ensure both 'items' and 'books' keys are provided for frontend flexibility
#     items = ranking_data.get("items", [])
#     ranking_data["books"] = items
#     ranking_data["total"] = ranking_data.get("count", len(items))

#     return JSONResponse(content=ranking_data)


# # 3. Save review for a book
# @router.post("/books/{slug}/reviews", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
# def add_review(
#     slug: str,
#     payload: ReviewCreate,
#     db: Session = Depends(get_db),
#     user: User | None = Depends(get_optional_user),
# ):
#     """Vote 1-5 and save review in database for a book slug."""
#     clean_slug = slug.removesuffix(".json").strip().lower()

#     reviewer_name = payload.reviewer_name
#     user_id = None
#     if user:
#         user_id = user.id
#         if not reviewer_name:
#             reviewer_name = user.email.split("@")[0].capitalize()
#     if not reviewer_name or not reviewer_name.strip():
#         reviewer_name = "Anonymous Reader"

#     new_review = Review(
#         book_slug=clean_slug,
#         user_id=user_id,
#         reviewer_name=reviewer_name.strip(),
#         rating=payload.rating,
#         comment=payload.comment.strip(),
#     )
#     db.add(new_review)
#     db.commit()
#     db.refresh(new_review)
#     return new_review


# # 4. Get all reviews for a book
# @router.get("/books/{slug}/reviews", response_model=list[ReviewRead])
# def get_reviews_for_book(slug: str, db: Session = Depends(get_db)):
#     """Fetch all local reviews saved for a book slug."""
#     clean_slug = slug.removesuffix(".json").strip().lower()
#     return db.scalars(
#         select(Review).where(Review.book_slug == clean_slug).order_by(Review.created_at.desc())
#     ).all()


# # 5. List popular supported categories
# @router.get("/categories", response_model=list[str])
# def list_categories():
#     """Return popular book categories supported by OpenBookRank."""
#     return [
#         "fantasy",
#         "sci-fi",
#         "romance",
#         "thriller",
#         "mystery",
#         "horror",
#         "historical-fiction",
#         "non-fiction",
#     ]
from fastapi import APIRouter

router = APIRouter(
    prefix="/v1",
    tags=["books"]
)

@router.get("/books/{slug}")
async def get_book_by_slug(slug: str):
    return {
        "slug": slug
    }