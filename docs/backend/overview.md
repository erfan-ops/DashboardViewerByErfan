# Backend Overview

> Generated: 2026-06-07 | Confidence: HIGH

## Architecture

The backend is a **FastAPI** application (Python 3.10) following a modular structure:

```
backend/app/
├── main.py           # App factory, lifespan, CORS, health endpoint
├── schemas.py        # Pydantic models for request/response serialization
├── api/              # Route handlers (thin controllers)
│   ├── routes.py     # Central router mounting
│   ├── auth.py       # Authentication endpoints + token validation
│   ├── dashboards.py # Dashboard CRUD + items + tabs + filters
│   ├── deps.py       # Authorization dependency injection
│   ├── editor.py     # SQL editor endpoints
│   └── user.py       # User profile endpoints
├── core/             # Cross-cutting infrastructure
│   ├── config.py     # Settings from .env
│   └── security.py   # Password hashing + JWT creation
├── services/         # Business logic (extracted from api/)
│   ├── filter_service.py       # Filter placeholder resolution engine
│   └── authorization_service.py # Role resolution logic
├── core/             # Cross-cutting infrastructure
│   ├── config.py     # Settings from .env
│   └── security.py   # Password hashing + JWT creation
└── db/               # Database layer
    ├── raw.py        # Raw-SQL execution helper
    ├── models.py     # SQLAlchemy ORM models
    └── session.py    # Engine creation + session factory
```

## Design Pattern

The backend follows a **thin-controller** pattern where:

1. **API handlers** (`api/*.py`) contain both route definitions AND business logic — there is business logic extracted to services/
2. **Dependencies** (`deps.py`, `auth.py`) handle cross-cutting concerns: authentication, authorization, and DB sessions
3. **Configuration** (`core/config.py`) uses pydantic-settings for `.env`-based configuration
4. **Data access** mixes SQLAlchemy ORM (for simple CRUD) with raw SQL via `text()` (for complex queries)

## Key Characteristics

| Characteristic | Detail |
|---------------|--------|
| Framework | FastAPI ≥0.114.0 |
| Python | 3.10 |
| Async | Uses FastAPI's async support, but endpoints are synchronous |
| DB Access | SQLAlchemy 2.0 with synchronous engine (not async) |
| Auth | JWT (HS256) with BCrypt password hashing (rounds=12) |
| AuthZ | RBAC with direct roles + group inheritance |
| Migrations | Alembic configured, but `create_all()` used on startup |
| Testing | pytest + httpx configured |
| Package Manager | uv |

## Module Responsibilities

| Module | Responsibility | Lines |
|--------|---------------|-------|
| `main.py` | App creation, CORS, health endpoint, dev server startup | ~57 |
| `api/routes.py` | Central router aggregation, ping endpoint | ~26 |
| `api/auth.py` | Login, register, JWT validation | ~120 |
| `api/dashboards.py` | Dashboard CRUD, items with dynamic SQL, tabs, filter groups (filter logic moved to services) | ~300 |
| `api/deps.py` | FastAPI dependency wiring (delegates to services/authorization_service) | ~35 |
| `services/filter_service.py` | Filter placeholder resolution engine (extracted from dashboards.py) | ~110 |
| `services/authorization_service.py` | Role resolution logic (extracted from deps.py) | ~35 |
| `api/editor.py` | SQL execution, save, load saved queries | ~117 |
| `api/user.py` | User roles endpoint | ~18 |
| `core/config.py` | Pydantic Settings from .env | ~34 |
| `core/security.py` | BCrypt password ops, JWT creation | ~34 |
| `db/models.py` | ORM models + association tables | ~103 |
| `db/raw.py` | Centralised raw-SQL execution helper | ~25 |
| `db/session.py` | Engine + session factory | ~27 |
| `schemas.py` | Pydantic response models | ~22 |

## Configuration Flow

```
.env file
  ↓ (pydantic-settings)
Settings class (LRU-cached singleton)
  ↓ (imported by)
session.py → DB URL construction
security.py → JWT secret + expiry
auth.py → token decoding
```

## Startup Sequence

1. `create_app()` is called
2. `lifespan` async context manager starts
3. `Base.metadata.create_all(bind=engine)` ensures all ORM tables exist (catches and logs errors)
4. CORS middleware added (allow all origins)
5. Three routes registered: `/health`, `/api/*` (via router)
6. Uvicorn serves on `127.0.0.1:8000`

## Error Handling

- No global exception handlers
- Each endpoint wraps logic in try/except
- HTTPException used for known error conditions (401, 403, 404, 409)
- Unexpected exceptions return HTTP 500 with `str(e)` as detail
- **Security concern:** Error messages may leak internal details (raw exception strings)
