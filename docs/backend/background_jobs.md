# Background Jobs

> Generated: 2026-06-07 | Confidence: HIGH

## Overview

The application uses FastAPI's `BackgroundTasks` for lightweight asynchronous operations. There is no dedicated task queue (no Celery, Redis, etc.).

---

## Background Tasks

### 1. Login Timestamp Update

**Trigger:** User successfully logs in via `POST /api/auth/login`

**Location:** `app/api/auth.py` lines 89-102

```python
def background_work(user_id):
    with db.bind.connect() as bg_conn:
        bg_conn.execute(
            text("UPDATE USERS SET LAST_LOGIN = SYSTIMESTAMP WHERE ID = :id"),
            {"id": user_id}
        )
        bg_conn.execute(
            text("UPDATE USERS SET UPDATEED_AT = SYSTIMESTAMP WHERE ID = :id"),
            {"id": user_id}
        )
        bg_conn.commit()

background_tasks.add_task(background_work, user.id)
```

**Purpose:** Update `LAST_LOGIN` and `UPDATED_AT` (note: typo "UPDATEED_AT" in code) timestamps after a successful login. Runs after the response is sent to the client.

**Why background:** These are non-critical audit updates — the login response shouldn't wait for them.

---

### 2. SQL Update Audit Log

**Trigger:** User saves an existing SQL query with changed text via `POST /api/editor/sql/save`

**Location:** `app/api/editor.py` lines 70-90

```python
def background_work(sql_id, old_sql_text, new_sql_text, user_id):
    with db.bind.connect() as bg_conn:
        bg_conn.execute(
            text("UPDATE SAVED_QUERIES SET UPDATED_AT = SYSTIMESTAMP WHERE ID = :id"),
            {"id": sql_id}
        )
        bg_conn.execute(
            text("INSERT INTO SAVED_QUERIES_UPDATE_LOG "
                 "(SQL_ID, OLD_SQL_TEXT, NEW_SQL_TEXT, USER_ID) "
                 "VALUES (:sql_id, :old_sql_text, :new_sql_text, :user_id)"),
            {...}
        )
        bg_conn.commit()

if old_sql_text != sql:
    background_tasks.add_task(background_work, sql_id, old_sql_text, sql, user.id)
```

**Purpose:** Track SQL query changes in an audit log. Only triggered when the actual SQL text changes. Runs after the save response is returned.

---

## Characteristics

| Aspect | Detail |
|--------|--------|
| Mechanism | FastAPI `BackgroundTasks` (in-process, no external broker) |
| Execution | Runs after the HTTP response is sent |
| DB Connection | Opens a new connection via `db.bind.connect()` (separate from request session) |
| Error Handling | **None** — If a background task fails, it fails silently |
| Retry | **None** — Failed background tasks are not retried |
| Monitoring | **None** — No logging of background task success/failure |

## Limitations

1. **No persistence** — If the process crashes before background tasks execute, they are lost
2. **No retry** — Failed tasks are silently dropped
3. **Blocking** — Background tasks run in the same process and share the event loop
4. **No monitoring** — Task failures are invisible unless manually logged

## Future Considerations

For production use, consider replacing `BackgroundTasks` with:
- **Celery** with Redis/RabbitMQ — Full task queue with retries, scheduling, monitoring
- **ARQ** — Lightweight Redis-based task queue for async Python
- **FastAPI BackgroundTasks** is adequate for the current workload (minor DB updates)
