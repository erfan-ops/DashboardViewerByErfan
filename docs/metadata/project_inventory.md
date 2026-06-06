# Project Inventory

> Generated: 2026-06-07 | Confidence: HIGH

## Directory Structure

```
DashboardViewerbyErfan/
├── Prompt.md                     # Reverse engineering instructions
├── README.md                     # Empty
├── .gitignore / .gitattributes   # Git configuration
│
├── backend/                      # FastAPI application (Python 3.10)
│   ├── .env                      # Environment variables (SECRET_KEY, Oracle creds)
│   ├── .python-version           # Python version pin (3.10)
│   ├── pyproject.toml            # Dependencies + project scripts
│   ├── uv.lock                   # Locked dependency versions
│   └── app/
│       ├── main.py               # FastAPI app factory, lifespan, CORS, healthcheck
│       ├── schemas.py            # Pydantic response/request models
│       ├── api/
│       │   ├── routes.py         # Main API router (/api prefix)
│       │   ├── auth.py           # Auth endpoints (login, register, token validation)
│       │   ├── dashboards.py     # Dashboard CRUD + items + tabs + filters
│       │   ├── deps.py           # Authorization dependency (require_any_role)
│       │   ├── editor.py         # SQL editor (execute, save, list saved)
│       │   └── user.py           # User endpoints (roles lookup)
│       ├── services/             # Business logic (extracted from api/)
│       │   ├── filter_service.py       # Filter placeholder resolution engine
│       │   └── authorization_service.py # Role resolution logic
│       ├── core/
│       │   ├── config.py         # Pydantic BaseSettings from .env
│       │   └── security.py       # BCrypt password hashing, JWT creation
│       └── db/
│           ├── raw.py            # Raw-SQL helper (centralised db.bind.connect)
│           ├── models.py         # ORM models (User, Role, Group, Dashboard, SavedQuery)
│           └── session.py        # SQLAlchemy engine + session factory
│
├── frontend/                     # React + TypeScript (Vite)
│   ├── index.html                # SPA entry point
│   ├── package.json              # Dependencies + scripts
│   ├── package-lock.json         # Locked dependency versions
│   ├── tsconfig.json             # TypeScript configuration
│   ├── vite.config.ts            # Vite config (proxy /api, /auth → :8000)
│   ├── fonts/                    # Persian font files (Vazir v18, Yekan)
│   ├── resources/                # Static assets (bill.svg icon)
│   └── src/
│       ├── main.tsx              # React entry: Chakra, Router, QueryClient, 401 interceptor
│       ├── theme.ts              # Chakra UI theme (light mode default)
│       ├── components/
│       │   ├── ProtectedRoute.tsx  # Auth guard (checks localStorage for JWT)
│       │   ├── ThemeToggle.tsx     # Light/dark mode toggle
│       │   ├── BarChartCanvas.tsx  # Bar chart wrapper
│       │   ├── LineChartCanvas.tsx # Line chart wrapper
│       │   └── PieChartCanvas.tsx  # Pie chart wrapper
│       ├── core/
│       │   ├── DashboardItem.ts   # Abstract base class for chart items
│       │   ├── BarChartItem.ts    # Canvas 2D stacked bar chart renderer
│       │   ├── LineChartItem.ts   # Canvas 2D multi-line chart renderer
│       │   ├── PieChartItem.ts    # Canvas 2D multi-pie donut chart renderer
│       │   └── utils.ts          # Color helpers, Persian digits, XML parsers
│       ├── types/
│       │   └── dashboard.ts       # Shared TypeScript interfaces
│       └── pages/
│           ├── HomePage.tsx       # Dashboard listing (role-aware)
│           ├── LoginPage.tsx      # Login form
│           ├── RegisterPage.tsx   # Registration form
│           ├── EditorPage.tsx     # SQL editor with Monaco
│           └── ViewerPage.tsx     # Dashboard viewer (tabs, filters, charts)
│
└── docs/                         # Documentation output (this directory)
```

## Entry Points

| Environment | Entry Point | File |
|-------------|------------|------|
| Backend (dev) | `python -m app.main` or `uvicorn app.main:app` | `backend/app/main.py` |
| Backend (prod) | `gunicorn app.main:app` | `backend/app/main.py` |
| Backend (CLI) | `backend` (console_script) | `backend/app/main.py:run()` |
| Frontend (dev) | `npm run dev` → Vite :5173 | `frontend/src/main.tsx` |
| Frontend (build) | `npm run build` → static files | `frontend/src/main.tsx` |

## Configuration Files

| File | Purpose | Key Values |
|------|---------|------------|
| `backend/.env` | Backend environment | SECRET_KEY, ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE_MINUTES=120, Oracle connection |
| `backend/pyproject.toml` | Python project metadata | Dependencies, dev-dependencies, console_script |
| `backend/.python-version` | Python version pin | `3.10` |
| `frontend/package.json` | Frontend metadata | Dependencies, scripts (dev/build/preview) |
| `frontend/tsconfig.json` | TypeScript config | ES2020, strict mode, React JSX |
| `frontend/vite.config.ts` | Vite build/dev config | Port 5173, proxy /api + /auth to :8000 |

## Database Schema (Oracle)

Tables managed by the application:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | ID, USERNAME, EMAIL, PASSWORD_HASH, ENABLED, ROLE, LAST_LOGIN |
| `roles` | Role definitions | id, name, description |
| `groups` | Group definitions | id, name, description |
| `user_roles` | Direct user-role assignments | user_id, role_id |
| `USER_GROUPS` | User-group memberships | USER_ID, GROUP_ID |
| `ROLE_GROUPS` | Role-group assignments | ROLE_ID, GROUP_ID |
| `dashboards` | Dashboard definitions | id, name, description |
| `USER_DASHBOARD_PRIVS` | Dashboard access control | USER_ID, DASHBOARD_ID, LAST_OPENED |
| `saved_queries` | Saved SQL queries | id, OWNER_ID, NAME, SQL_TEXT |
| `DASHBOARD_ITEMS` | Dashboard visual items | ID, DASHBOARD_ID, ITEM_TYPE, SQL_ID, TAB_ID, GEOMETRY, ATTRIBUTES |
| `DASHBOARD_TABS` | Dashboard tab definitions | ID, DASHBOARD_ID, NAME_, DISPLAY_ORDER |
| `DASHBOARD_FILTERS` | Filter definitions | id, filter_key, operator_type, data_type, default_value |
| `DASHBOARD_FILTER_BINDINGS` | Binds filters to SQL queries | filter_id, sql_id, logical_column |
| `DASHBOARD_FILTER_GROUPS` | Filter group containers | id, name, position, dashboard_id, tab_id |
| `DASHBOARD_FILTER_GROUP_MEMBERS` | Filter-to-group mappings | group_id, filter_id |
| `SAVED_QUERIES_UPDATE_LOG` | Audit log for SQL changes | SQL_ID, OLD_SQL_TEXT, NEW_SQL_TEXT, USER_ID |

**NOTE:** The application uses Oracle sequences `user_id_seq` and `saved_queries_id_seq` for ID generation on INSERT.

## Build & Run Commands

```bash
# Backend
cd backend
uv run python -m app.main          # or: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm run dev                        # Vite dev server on :5173
npm run build                      # Production build to dist/
npm run preview                    # Preview production build
```
