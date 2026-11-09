# Python Backend Template (FastAPI + SQLAlchemy)

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Docs: http://localhost:8000/docs
Web UI (Register/Login): http://localhost:8000/
Web UI (Category Rankings): http://localhost:8000/rankings
Web UI (Book Details & Reviews): http://localhost:8000/books/the-name-of-the-wind

## Books & Rankings API (v1)
- **Book Details**: `GET /api/v1/books/{slug}.json` — Returns book data (score, confidence, category rankings, identifiers, similar books, and reviews).
- **Category Rankings**: `GET /api/v1/rankings/{category}.json` — Returns a ranked list of books in a category (e.g. `fantasy`, `sci-fi`, `thriller`).
- **Submit 1-5 Star Review**: `POST /api/v1/books/{slug}/reviews` — Submit a 1-5 star vote and review comment (recalculates book score dynamically).
- **Categories**: `GET /api/v1/categories` — List available book categories.

## Test
```bash
pytest
```

## Authentication & Login API (JWT)
The application includes JWT authentication with password hashing using bcrypt:

- **Register**: `POST /api/auth/register` — Creates a new user (`email`, `password`, optional `role`: `"reader"` or `"admin"`, defaults to `"reader"`).
- **Login (JSON)**: `POST /api/auth/login` — Accepts `{ "email": "...", "password": "..." }` and returns `{ "access_token": "...", "token_type": "bearer", "role": "..." }`.
- **OAuth2 Token**: `POST /api/auth/token` — Accepts form data (`username`, `password`) compatible with FastAPI's OpenAPI `/docs` "Authorize" button.
- **Current User Profile**: `GET /api/auth/me` — Protected endpoint returning current user details including assigned role.
- **Change User Role**: `PATCH /api/auth/users/{user_id}/role` — Admin-only endpoint to update a user's role.
- **List Roles**: `GET /api/roles` — Returns available roles (`admin`, `reader`).

### Roles & Role-Based Access Control (RBAC)
The database automatically seeds two initial roles:
- `admin`: Full administrative access
- `reader`: Standard read privileges

Protect routes using `require_admin` or `require_role`:

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from app.models import User
from app.security import require_admin, require_role

router = APIRouter()

@router.get("/admin-only")
def admin_route(admin_user: Annotated[User, Depends(require_admin)]):
    return {"message": f"Welcome admin {admin_user.email}"}
```

## Database (MySQL)
The project is configured to use MySQL (`book_review` database) via the `PyMySQL` driver.

Connection URL:
```env
DATABASE_URL=mysql+pymysql://appuser:apppassword@localhost:3306/book_review
```

### Run with Docker Compose
You can run both MySQL and the FastAPI backend service together:
```bash
docker compose -f docker/docker-compose.yml up -d --build
```
Or start only the database:
```bash
docker compose -f docker/docker-compose.yml up -d db
```

## Layout
```text
docker/
  docker-compose.yml   MySQL (book_review) and backend service definitions
app/
  main.py        App setup, CORS, router mounting, lifespan
  config.py      Env-based settings (database URL, JWT secret key, CORS)
  db.py          Engine, session factory, get_db dependency
  models.py      SQLAlchemy models (Item, User)
  schemas.py     Pydantic request/response models
  security.py    Password hashing (bcrypt), JWT helpers, get_current_user dependency
  routers/
    auth.py      Authentication endpoints (register, login, token, me)
    health.py    Health check endpoint (/health)
    items.py     Example CRUD endpoints
tests/           Pytest suite + shared in-memory SQLite fixtures
```
