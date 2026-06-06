# Dashboard Viewer

A web-based dashboard viewing and editing application — an OBIEE clone. Connects to an Oracle database, executes parameterized SQL queries, and renders data as interactive charts on a Persian/RTL interface.

## Architecture

```
React 18 (TypeScript)  ──▶  FastAPI (Python 3.10)  ──▶  Oracle DB
    (Vite :5173)               (Uvicorn :8000)           (192.168.1.42:1521)
```

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Chakra UI, React Router v6, Custom Canvas 2D charts |
| Backend | FastAPI, SQLAlchemy 2.0, python-jose (JWT), passlib (BCrypt) |
| Database | Oracle (oracledb driver), 15+ tables, dynamic SQL filtering |

## Quick Start

```bash
# 1. Backend
cd backend
cp .env .env.example   # edit with your Oracle credentials + secret key
uv sync
uv run python -m app.main          # → http://127.0.0.1:8000

# 2. Frontend
cd frontend
npm install
npm run dev                        # → http://localhost:5173
```

Open `http://localhost:5173`. Vite proxies `/api` and `/auth` to the backend automatically.

### Database

Tables mapped in ORM models are auto-created on startup. The following tables must exist already (no ORM models):

`DASHBOARD_ITEMS`, `DASHBOARD_TABS`, `DASHBOARD_FILTERS`, `DASHBOARD_FILTER_BINDINGS`, `DASHBOARD_FILTER_GROUPS`, `DASHBOARD_FILTER_GROUP_MEMBERS`, `SAVED_QUERIES_UPDATE_LOG`

Oracle sequences required: `user_id_seq`, `saved_queries_id_seq`

Test connectivity:
```bash
sqlplus TM/tm@192.168.1.42:1521/pdb.oracle.ek
curl http://127.0.0.1:8000/health
```

## Project Structure

```
project-root/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py             # App factory, CORS, health endpoint
│   │   ├── schemas.py          # Pydantic request/response models
│   │   ├── api/
│   │   │   ├── routes.py       # Router aggregation (/api prefix)
│   │   │   ├── auth.py         # Login, register, token validation
│   │   │   ├── dashboards.py   # Dashboard CRUD + items + tabs + filters
│   │   │   ├── deps.py         # RBAC dependency injection
│   │   │   ├── editor.py       # SQL execute, save, list saved
│   │   │   └── user.py         # User roles lookup
│   │   ├── core/
│   │   │   ├── config.py       # Settings from .env (pydantic-settings)
│   │   │   └── security.py     # BCrypt hashing + JWT creation
│   │   └── db/
│   │       ├── base.py         # SQLAlchemy Base re-export
│   │       ├── models.py       # ORM models (User, Role, Group, Dashboard, SavedQuery)
│   │       └── session.py      # Engine + session factory (oracle+oracledb)
│   ├── .env                    # Environment variables
│   └── pyproject.toml          # Dependencies (uv)
│
├── frontend/                   # React + TypeScript (Vite)
│   └── src/
│       ├── main.tsx            # Entry: providers, router, fonts, 401 interceptor
│       ├── theme.ts            # Chakra UI theme
│       ├── components/
│       │   ├── ProtectedRoute.tsx  # Auth guard
│       │   └── ThemeToggle.tsx     # Light/dark toggle
│       ├── core/
│       │   ├── DashboardItem.ts    # Abstract chart base class
│       │   ├── BarChartItem.ts     # Canvas 2D stacked bar chart
│       │   ├── LineChartItem.ts    # Canvas 2D multi-line chart
│       │   ├── PieChartItem.ts     # Canvas 2D donut chart grid
│       │   └── utils.ts           # Colors, Persian digits, XML parsers
│       └── pages/
│           ├── HomePage.tsx        # Dashboard listing
│           ├── LoginPage.tsx       # Login form
│           ├── RegisterPage.tsx    # Registration form
│           ├── EditorPage.tsx      # SQL editor (Monaco)
│           └── ViewerPage.tsx      # Dashboard viewer (tabs, filters, charts)
│
└── docs/                       # Full documentation (see docs/README.md)
```

## Features

- **Dashboard Viewer** — Tabbed dashboards with positioned chart items (bar, line, pie) rendered on HTML Canvas 2D
- **Dynamic SQL Filtering** — Runtime filters with `{{filter:key}}` placeholder syntax supporting =, >, <, IN, BETWEEN, LIKE operators
- **SQL Editor** — Monaco-based SQL IDE with execute/save/load functionality
- **RBAC Authorization** — Roles and groups with inheritance (direct roles + group-inherited roles)
- **JWT Authentication** — BCrypt password hashing (12 rounds), HS256 tokens
- **Persian/RTL Interface** — Persian digits, Vazir/Yekan fonts, RTL layout
- **Light/Dark Mode** — Chakra UI color mode with toggle

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| GET | `/api/ping` | — | DB connectivity |
| POST | `/api/auth/login` | — | Login → JWT |
| POST | `/api/auth/register` | — | Register |
| GET | `/api/user/roles` | Any | Current user's roles |
| GET | `/api/dashboards/mine` | viewer+ | My dashboards |
| POST | `/api/dashboards/` | editor, admin | Create dashboard |
| GET | `/api/dashboards/{id}` | viewer+ | Dashboard metadata |
| GET | `/api/dashboards/{id}/items` | viewer+ | Items with SQL data + filters |
| GET | `/api/dashboards/{id}/tabs` | viewer+ | Tab definitions |
| GET | `/api/dashboards/{id}/filter-groups` | viewer+ | Filter group config |
| POST | `/api/editor/sql/execute` | editor, admin | Execute SELECT |
| POST | `/api/editor/sql/save` | editor, admin | Save SQL query |
| GET | `/api/editor/sql/saved` | editor, admin | List saved queries |

Full API docs available at `http://127.0.0.1:8000/docs` (Swagger) when backend is running.

## Configuration

### Backend (`.env`)

```env
SECRET_KEY=<random-64-char-string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
ORACLE_HOST=192.168.1.42
ORACLE_PORT=1521
ORACLE_SERVICE=pdb.oracle.ek
ORACLE_USERNAME=TM
ORACLE_PASSWORD=tm
```

### Frontend

Vite proxies are configured in `vite.config.ts`. No additional `.env` required for development.

## Filter System

Dashboard SQL queries can contain `{{filter:key}}` placeholders. At runtime, the backend replaces them with parameterized predicates:

```sql
SELECT region, SUM(amount) AS total
FROM sales
WHERE 1=1
  {{filter:fAmount}}  -- replaced with: AND AMOUNT > :p_fAmount_1
  {{filter:fRegion}}  -- replaced with: REGION IN (:p_fRegion_1_0, :p_fRegion_1_1)
GROUP BY region
```

Value resolution order: user-provided → filter default → (allow_empty? skip : return no rows)

## Authentication

- **Login:** POST `/api/auth/login` (form-encoded) returns JWT
- **JWT:** HS256, 120-minute expiry, stored in `localStorage`
- **Axios interceptor:** Global 401 handler clears token and redirects to `/login`
- **RBAC:** `require_any_role()` checks direct roles + group-inherited roles

Default roles: `dashboard_viewer`, `dashboard_editor`, `admin`

## Known Issues

| Severity | Issue |
|----------|-------|
| 🔴 High | Dashboard `spec` and `owner_id` passed to model constructor but not mapped — data silently lost |
| 🔴 High | `messure` typo in `parsePieAttributes()` — pie measure attribute never read from XML |
| 🟡 Medium | N+1 queries in dashboard items endpoint (~40 queries for 20 items) |
| 🟡 Medium | JWT in `localStorage` — vulnerable to XSS (consider httpOnly cookie) |
| 🟡 Medium | Default credentials hardcoded in `LoginPage.tsx` (`useState('admin')`) |
| 🟡 Medium | `RegisterPage` `useEffect` runs on every render (missing dependency array) |
| 🟡 Medium | CORS allows all origins — restrict in production |
| 🟡 Medium | No rate limiting on login endpoint |
| 🟡 Medium | `echarts` imported but unused — adds bundle size |

Full analysis and suggested fixes in `docs/pitfalls/`.

## Documentation

Comprehensive documentation is in the `docs/` directory:

- **[docs/README.md](docs/README.md)** — Full documentation index
- **[docs/architecture.md](docs/architecture.md)** — System architecture with Mermaid diagrams
- **[docs/development_guide.md](docs/development_guide.md)** — Setup, debugging, testing
- **[docs/deployment.md](docs/deployment.md)** — Production deployment guide
- **[docs/pitfalls/](docs/pitfalls/)** — Known issues and risks (7 files)

## Production Deployment

```bash
# Backend
cd backend && uv sync --no-dev
uv run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend
cd frontend && npm run build   # → dist/ (serve with nginx)
```

Before deploying: change `SECRET_KEY`, restrict `CORS_ORIGINS`, disable `Base.metadata.create_all()` on startup, and serve behind HTTPS.
