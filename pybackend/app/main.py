from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401  (registers tables)
from .config import settings
from .db import engine
from .init_db import init_db
from .routers import auth, books, health, items, roles

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed default roles and books
    init_db(engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# HTML Page Routes
@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/rankings", include_in_schema=False)
@app.get("/rankings/{category}", include_in_schema=False)
def serve_rankings(category: str = "fantasy"):
    return FileResponse(STATIC_DIR / "rankings.html")


@app.get("/books/{slug}", include_in_schema=False)
def serve_book_page(slug: str):
    return FileResponse(STATIC_DIR / "book.html")


# API Routers
app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(books.router, prefix="/api")
