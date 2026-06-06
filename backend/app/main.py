from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.routes import router as api_router
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Prefer Alembic in production; this is for first boot/dev convenience
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # noqa: BLE001
        # Log and continue so the app can start even if DB is unavailable
        print(f"[startup] Skipping DB init (reason: {exc})")
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Dashboard Viewer", version="0.1.0", lifespan=lifespan, openapi_tags=[{"name": "auth", "description": "Login operations"}])

    # CORS - adjust origins in .env later
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def healthcheck():
        return {"status": "ok"}

    app.include_router(api_router)

    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    run()
