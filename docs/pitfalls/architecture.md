# Pitfalls: Architecture

> Generated: 2026-06-07 | Confidence: HIGH

## 1. No Service Layer — Business Logic in Endpoints

**Severity:** Medium | **Files:** `api/auth.py`, `api/dashboards.py`, `api/editor.py`

**Why it exists:** The codebase started small and grew organically. All business logic lives directly in FastAPI endpoint functions.

**Why it's risky:**
- Cannot test business logic independently of HTTP
- Logic duplication when multiple endpoints need similar operations
- Hard to reason about data flow across the system
- Endpoint functions exceed 100+ lines (dashboards.py items endpoint is ~200 lines)

**Suggested improvement:** Extract business logic into service classes/modules. Endpoints should be thin controllers that delegate to services.

---

## 2. Dashboard Model Missing Columns

**Severity:** High | **File:** `db/models.py` lines 93-101, `api/dashboards.py` line 86

**The issue:** The `Dashboard` ORM model only defines `id`, `name`, and `description`. But `save_dashboard()` passes `spec` and `owner_id` to the constructor:
```python
d = Dashboard(name=payload.name, spec=payload.spec, owner_id=user.id)
```
These attributes are NOT mapped columns. This will either:
- Set arbitrary Python attributes (ignored by SQLAlchemy on flush)
- Raise an error if the model is configured with strict validation

**Why it's risky:** Dashboard `spec` data (layout, widgets) is silently lost. User-ownership tracking is missing.

**Suggested improvement:** Add `spec` (JSON) and `owner_id` (FK→users) as mapped columns on the Dashboard model.

---

## 3. `Base.metadata.create_all()` on Every Startup

**Severity:** Medium | **File:** `main.py` lines 11-16

**The issue:** The lifespan handler calls `Base.metadata.create_all(bind=engine)` every time the app starts. This checks for every table's existence and only creates missing ones, but:
- It runs unnecessary DDL queries on every restart
- If the DB connection is slow, it delays startup
- In production, DDL should never be executed at startup

**Why it exists:** Development convenience — avoids running Alembic migrations.

**Suggested improvement:** Gate behind an environment check: only run in "dev" environment.

---

## 4. CORS Allows All Origins

**Severity:** Medium (dev) / High (prod) | **File:** `main.py` line 26

```python
allow_origins=["*"]
```

**Why it exists:** Simplifies development when frontend runs on a different port.

**Why it's risky:** In production, any website can make authenticated requests to the API. Combined with `allow_credentials=True`, this is a CSRF vulnerability.

**Suggested improvement:** Read `cors_origins` from config and restrict to specific domains in production.

---

## 5. No Error Handling Middleware

**Severity:** Medium | **Files:** All API endpoints

**The issue:** Each endpoint has its own try/except block. Uncaught exceptions return HTTP 500 with raw exception messages:
```python
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

**Why it's risky:**
- Internal error details leak to clients (database errors, stack traces)
- No centralized error logging
- Inconsistent error response format across endpoints

**Suggested improvement:** Add FastAPI exception handlers for consistent error responses and logging.

---

## 6. `spec` Field Not Persisted

**Severity:** High | **Files:** `db/models.py`, `api/dashboards.py`

The `save_dashboard` endpoint accepts a `spec` dict but the Dashboard model has no column for it. This means dashboard layout specifications are never saved, making it impossible to reconstruct dashboard layouts.

**Suggested improvement:** Add `spec = mapped_column(JSON)` to the Dashboard model.

---

## 7. Missing Response Model Type Annotation

**Severity:** Low | **File:** `api/dashboards.py` line 366

```python
@router.get("/{dashboard_id}/filter-groups")
def get_dashboard_filter_groups(..., response_model=DashboardFilterGroupResult):
    ...
    return list(groups.values())  # Returns a LIST, not a single object
```

The response_model annotation says singular `DashboardFilterGroupResult` but the function returns a list. The OpenAPI schema will be incorrect.

**Suggested improvement:** Change to `response_model=List[DashboardFilterGroupResult]`.
