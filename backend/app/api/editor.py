from typing import Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.deps import require_any_role
from app.db.session import get_db


router = APIRouter(prefix="/editor", tags=["editor"])


class ExecuteSQLRequest(BaseModel):
    sql: str
    limit: int | None = 1000

class SaveSQLRequest(BaseModel):
    name: str
    sql: str


@router.post("/sql/execute")
def execute_sql(req: ExecuteSQLRequest, db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_editor", "admin"))):
    sql = req.sql.strip().rstrip(";")
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT statements are allowed")
    limit_clause = f" FETCH FIRST {req.limit} ROWS ONLY" if req.limit else ""
    stmt = text(sql + limit_clause)
    with db.bind.connect() as conn:  # type: ignore[attr-defined]
        result = conn.execute(stmt)
        rows = [list(r) for r in result]
        columns = list(result.keys())
    return {"columns": columns, "rows": rows}

@router.post("/sql/save")
def save_sql(
    req: SaveSQLRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(require_any_role("dashboard_editor", "admin"))
):
    sql = req.sql.strip().rstrip(";")
    if not sql.lower().startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT statements are allowed")

    try:
        with db.bind.connect() as conn:  # type: ignore[attr-defined]
            # Check if the name already exists for this user
            existing = conn.execute(
                text("SELECT ID, SQL_TEXT FROM SAVED_QUERIES WHERE NAME = :name"),
                {"name": req.name}
            ).fetchone()

            if existing:
                sql_id = existing[0]
                old_sql_text = existing[1]

                # Update the SQL text
                conn.execute(
                    text("UPDATE SAVED_QUERIES SET SQL_TEXT = :sql_text WHERE ID = :id"),
                    {"sql_text": sql, "id": sql_id}
                )
                conn.commit()

                # Return response early
                response = {"success": True, "updated": True}

                # Schedule background work
                def background_work(sql_id, old_sql_text, new_sql_text, user_id):
                    with db.bind.connect() as bg_conn:
                        # Update UPDATED_AT column
                        bg_conn.execute(
                            text("UPDATE SAVED_QUERIES SET UPDATED_AT = SYSTIMESTAMP WHERE ID = :id"),
                            {"id": sql_id}
                        )
                        # Insert update log
                        bg_conn.execute(
                            text("INSERT INTO SAVED_QUERIES_UPDATE_LOG (SQL_ID, OLD_SQL_TEXT, NEW_SQL_TEXT, USER_ID) VALUES (:sql_id, :old_sql_text, :new_sql_text, :user_id)"),
                            {
                                "sql_id": sql_id,
                                "old_sql_text": old_sql_text,
                                "new_sql_text": new_sql_text,
                                "user_id": user_id,
                            }
                        )
                        bg_conn.commit()

                if old_sql_text != sql:
                    background_tasks.add_task(background_work, sql_id, old_sql_text, sql, user.id)
                return response

            else:
                # Insert new row if it doesn't exist
                conn.execute(
                    text("""
                        INSERT INTO SAVED_QUERIES (ID, OWNER_ID, NAME, SQL_TEXT)
                        VALUES (saved_queries_id_seq.nextval, :owner_id, :name, :sql_text)
                    """),
                    {"owner_id": user.id, "name": req.name, "sql_text": sql}
                )
                conn.commit()
                return {"success": True, "created": True}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sql/saved")
def get_saved_queries(db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_editor", "admin"))):
    stmt = text("SELECT NAME, SQL_TEXT FROM SAVED_QUERIES ORDER BY CREATED_AT DESC")
    try:
        with db.bind.connect() as conn:  # type: ignore[attr-defined]
            result = conn.execute(stmt)
            queries = [{"name": row[0], "sql_text": row[1]} for row in result]
        return {"queries": queries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))