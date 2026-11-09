from sqlalchemy import inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .db import Base
from .models import Review, Role, User


def init_db(engine: Engine) -> None:
    # 1. Clean up legacy books table if it still exists
    inspector = inspect(engine)
    if "books" in inspector.get_table_names():
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS reviews"))
            conn.execute(text("DROP TABLE IF EXISTS books"))
            conn.commit()

    # 2. Create tables if they don't exist
    Base.metadata.create_all(engine)

    # 3. Add role_id column to existing users table if missing (e.g. existing DBs without migrations)
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "role_id" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN role_id INT NULL"))
                conn.commit()

    # 4. Seed default roles: admin and reader
    with Session(engine) as session:
        roles_data = [
            ("admin", "Administrator with full system privileges"),
            ("reader", "Reader with standard read privileges"),
        ]
        reader_role = None
        for name, desc in roles_data:
            existing = session.scalar(select(Role).where(Role.name == name))
            if not existing:
                role = Role(name=name, description=desc)
                session.add(role)
                session.flush()
                if name == "reader":
                    reader_role = role
            elif name == "reader":
                reader_role = existing

        # Assign default reader role to any existing users that have no role
        if reader_role:
            users_without_role = session.scalars(
                select(User).where(User.role_id.is_(None))
            ).all()
            for user in users_without_role:
                user.role_id = reader_role.id

        session.commit()
