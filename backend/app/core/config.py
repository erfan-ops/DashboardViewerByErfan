from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Dashboard Viewer"
    environment: str = "dev"

    # JWT/auth
    secret_key: str = "change-me-in-.env"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    # CORS
    cors_origins: str = "*"

    # Database (Oracle)
    oracle_host: str = "192.168.1.42"
    oracle_port: int = 1521
    oracle_service: str = "pdb.oracle.ek"
    oracle_username: str = "app_user"
    oracle_password: str = "app_password"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


