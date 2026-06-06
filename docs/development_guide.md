# Development Guide

> Generated: 2026-06-07 | Confidence: HIGH

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | ≥3.10 | `python --version` |
| uv (Python package manager) | Latest | `uv --version` |
| Node.js | ≥18 | `node --version` |
| npm | ≥9 | `npm --version` |
| Oracle DB access | — | Must be reachable from your machine |

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repo-url>
cd DashboardViewerbyErfan
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies (uv reads pyproject.toml + uv.lock)
uv sync

# Configure environment
# Edit .env with your Oracle credentials and a secure SECRET_KEY
# Default: ORACLE_HOST=192.168.1.42, ORACLE_PORT=1521, ORACLE_SERVICE=pdb.oracle.ek
```

**`.env` configuration:**

```env
SECRET_KEY=<generate a secure random key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
ORACLE_HOST=192.168.1.42
ORACLE_PORT=1521
ORACLE_SERVICE=pdb.oracle.ek
ORACLE_USERNAME=<your_oracle_user>
ORACLE_PASSWORD=<your_oracle_password>
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

---

## Running the Application

### Backend (Development)

```bash
cd backend

# Option 1: Via console_script
uv run backend

# Option 2: Direct uvicorn
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Option 3: Via python
uv run python -m app.main
```

The backend starts at `http://127.0.0.1:8000`.

### Frontend (Development)

```bash
cd frontend

npm run dev
```

The frontend starts at `http://localhost:5173` with HMR enabled.

Vite proxies `/api` and `/auth` requests to `http://127.0.0.1:8000`.

### Both Together

```bash
# Terminal 1
cd backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Database Setup

### Auto-Created Tables (on startup)

The application automatically creates ORM-mapped tables on startup via `Base.metadata.create_all()`. These tables are:
- `users`
- `roles`
- `groups`
- `user_roles`
- `USER_GROUPS`
- `ROLE_GROUPS`
- `dashboards`
- `USER_DASHBOARD_PRIVS`
- `saved_queries`

### Manually Required Tables

These tables are NOT auto-created (no ORM model) and must exist in the Oracle database:

- `DASHBOARD_ITEMS`
- `DASHBOARD_TABS`
- `DASHBOARD_FILTERS`
- `DASHBOARD_FILTER_BINDINGS`
- `DASHBOARD_FILTER_GROUPS`
- `DASHBOARD_FILTER_GROUP_MEMBERS`
- `SAVED_QUERIES_UPDATE_LOG`

### Sequences

The following Oracle sequences must exist:
- `user_id_seq`
- `saved_queries_id_seq`

---

## Testing Database Connectivity

```bash
# Backend health check
curl http://127.0.0.1:8000/health

# DB connectivity check
curl http://127.0.0.1:8000/api/ping

# Direct Oracle test (requires SQL*Plus)
sqlplus TM/tm@192.168.1.42:1521/pdb.oracle.ek
```

---

## Creating a Test User

Register via the frontend at `/register`, or insert directly:

```sql
-- Oracle SQL
INSERT INTO USERS (ID, USERNAME, EMAIL, PASSWORD_HASH, ROLE, ENABLED)
VALUES (user_id_seq.nextval, 'test', 'test@example.com',
        '$2b$12$...', 'ROLE_USER', 1);
```

Note: The BCrypt hash must be generated with 12 rounds. You can use the Python code:
```python
import bcrypt
hash = bcrypt.hashpw(b"password", bcrypt.gensalt(12)).decode()
print(hash)
```

---

## API Documentation (Auto-Generated)

Once the backend is running:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

You can test login directly from Swagger UI using the `/api/auth/login` endpoint.

---

## Debugging

### Backend

```python
# Add print statements (they appear in uvicorn console)
print(f"[DEBUG] value = {value}")

# Check Oracle connectivity
from app.db.session import engine
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM dual"))
    print(result.fetchone())
```

### Frontend

- **React DevTools:** Install the browser extension
- **Network tab:** Monitor API calls, check request/response payloads
- **Console:** Check for JavaScript errors
- **Application tab → Local Storage:** Inspect JWT token

### Common Debug Commands

```bash
# Check Python dependencies
cd backend && uv pip list

# Check frontend dependencies
cd frontend && npm list --depth=0

# TypeScript type checking
cd frontend && npx tsc --noEmit

# Production build test
cd frontend && npm run build && npm run preview
```

---

## Testing

### Backend Tests

```bash
cd backend
uv run pytest
```

Note: Tests require a running Oracle database. Use a test database or mock the database layer.

### Frontend

No tests are currently configured. To add tests:
```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

## Code Organization Conventions

- **Backend:** FastAPI routers in `app/api/`, each file handles one resource area
- **Frontend:** Pages in `src/pages/`, shared components in `src/components/`, core logic in `src/core/`
- **Database queries:** Simple queries use ORM, complex queries use raw SQL with `text()`
- **Auth:** JWT tokens validated in `get_current_user()`, roles checked via `require_any_role()`

---

## Production Deployment Notes

```bash
# Backend - Production
cd backend
uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend - Production Build
cd frontend
npm run build
# Serve dist/ with nginx, CDN, or static file server
```

**Before deploying to production:**
1. Change `SECRET_KEY` to a cryptographically random value
2. Restrict `cors_origins` to your frontend domain
3. Set `environment = "production"` in `.env`
4. Remove `Base.metadata.create_all()` (use Alembic migrations)
5. Serve frontend and backend behind a reverse proxy (nginx)
6. Enable HTTPS
7. Configure proper logging
