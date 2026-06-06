from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings


def build_oracle_url() -> str:
    s = get_settings()
    # Using sqlalchemy-oracledb driver
    return (
        f"oracle+oracledb://{s.oracle_username}:{s.oracle_password}"
        f"@{s.oracle_host}:{s.oracle_port}/?service_name={s.oracle_service}"
    )


engine = create_engine(build_oracle_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


