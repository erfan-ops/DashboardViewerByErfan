from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.auth import router as auth_router
from app.api.editor import router as editor_router
from app.api.dashboards import router as dashboards_router
from app.api.user import router as user_router


router = APIRouter(prefix="/api")


@router.get("/ping")
def ping(db: Session = Depends(get_db)):
    # Light DB touch to validate connectivity lazily
    return {"message": "pong"}


# mount sub-routers
router.include_router(auth_router)
router.include_router(editor_router)
router.include_router(dashboards_router)
router.include_router(user_router)


