# System Architecture

> Generated: 2026-06-07 | Confidence: HIGH

## Overview

The Dashboard Viewer is a **two-tier web application** that provides an OBIEE-like dashboard viewing and editing experience. It consists of:

1. A **FastAPI backend** (Python 3.10) serving a REST API and connecting to an Oracle database
2. A **React/TypeScript frontend** (Vite) providing a Persian/RTL user interface

The system allows users to:
- Authenticate via JWT-based login
- View dashboards composed of SQL-backed charts (Bar, Line, Pie)
- Edit SQL queries through an in-browser Monaco editor
- Apply runtime filters to dashboard data
- Navigate dashboard tabs

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Browser"]
        FE["React SPA<br/>Vite Dev Server :5173<br/>Chakra UI + Canvas 2D"]
    end

    subgraph Backend["🖥️ Backend Server"]
        API["FastAPI<br/>Uvicorn :8000<br/>Python 3.10"]
        subgraph Layers["Application Layers"]
            direction TB
            MW["Middleware Layer<br/>CORS"]
            RT["Router Layer<br/>REST API /api/*"]
            DEP["Dependency Layer<br/>Auth + RBAC + DB Session"]
            SVC["Service Logic<br/>Inline in endpoints"]
            DB_LIB["Data Access<br/>SQLAlchemy ORM + raw SQL"]
        end
    end

    subgraph DB["🗄️ Database"]
        Oracle["Oracle Database<br/>192.168.1.42:1521<br/>pdb.oracle.ek"]
    end

    FE -->|"HTTP REST (JSON + Form)<br/>Bearer Token"| API
    MW --> RT --> DEP --> SVC --> DB_LIB
    DB_LIB -->|"oracle+oracledb"| Oracle
```

---

## Application Startup Sequence

### Backend Startup

```mermaid
sequenceDiagram
    participant Process as Python Process
    participant Main as main.py
    participant Config as core/config.py
    participant DB as db/session.py
    participant Base as db/base.py
    participant Models as db/models.py
    participant App as FastAPI App
    participant Router as api/routes.py

    Process->>Main: python -m app.main
    Main->>Config: get_settings() — reads .env
    Config-->>Main: Settings singleton

    Main->>Main: create_app()
    Main->>Main: lifespan: startup
    Note over Main: @asynccontextmanager

    Main->>DB: create_engine(build_oracle_url())
    DB->>Config: get_settings()
    DB-->>Main: engine

    Main->>Base: Base.metadata.create_all(bind=engine)
    Base->>Models: Create tables from ORM metadata
    Note over Base: Catches exception,<br/>logs warning, continues

    Main->>App: FastAPI(title, version, lifespan)
    Main->>App: add_middleware(CORS, origins=["*"])
    Main->>App: @app.get("/health")
    Main->>App: app.include_router(api_router)
    Main->>Router: router = APIRouter(prefix="/api")
    Router->>Router: include_router(auth_router)
    Router->>Router: include_router(editor_router)
    Router->>Router: include_router(dashboards_router)
    Router->>Router: include_router(user_router)

    App-->>Process: Ready, listening on :8000
```

### Frontend Startup

```mermaid
sequenceDiagram
    participant Browser
    participant Vite as Vite Dev Server :5173
    participant React as React App
    participant Router as React Router
    participant Axios as Axios

    Browser->>Vite: Request index.html
    Vite-->>Browser: SPA shell + main.tsx

    Browser->>React: ReactDOM.createRoot()
    React->>React: loadFonts() — inject @font-face CSS
    React->>Axios: Register 401 response interceptor
    React->>React: Render providers:
    Note over React: ChakraProvider > QueryClientProvider > RouterProvider

    React->>Router: Match current URL
    alt URL is /
        Router->>Browser: Render HomePage
    alt URL is /login
        Router->>Browser: Render LoginPage
    alt URL is /editor or /viewer/:id
        Router->>Browser: Render ProtectedRoute
        alt JWT in localStorage
            Router->>Browser: Render page
        else No JWT
            Router->>Browser: Navigate to /login
        end
    end
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant Client as Browser
    participant Proxy as Vite Proxy
    participant FastAPI as FastAPI App
    participant CORS as CORS Middleware
    participant Router as API Router (/api)
    participant Dep as Dependency (auth + RBAC)
    participant Handler as Endpoint Function
    participant DB as Oracle Database

    Client->>Proxy: HTTP Request (JSON or Form)
    Note over Client: Authorization: Bearer <jwt>

    Proxy->>FastAPI: Forward to :8000
    FastAPI->>CORS: Check origin (allow all)

    CORS->>Router: Route to sub-router
    Note over Router: /api/auth, /api/dashboards,<br/>/api/editor, /api/user

    Router->>Dep: Resolve dependencies
    Dep->>Dep: get_db() — yield SQLAlchemy session
    Dep->>Dep: get_current_user() — decode JWT
    Dep->>Dep: require_any_role() — RBAC check
    Note over Dep: 401 if token invalid<br/>403 if missing role

    Dep->>Handler: Call endpoint with resolved deps
    Handler->>DB: Execute query (ORM or raw SQL)
    DB-->>Handler: Results
    Handler-->>Client: JSON Response
```

---

## Middleware Stack

| Order | Middleware | Purpose | Configuration |
|-------|-----------|---------|---------------|
| 1 | CORS | Cross-Origin Resource Sharing | `allow_origins=["*"]`, `allow_credentials=True`, all methods/headers |
| 2 | Router | URL path routing | `/api` prefix with sub-routers |

**Note:** No custom middleware for logging, rate limiting, or request ID generation. The middleware stack is minimal.

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Backend
    participant DB

    Note over Client,DB: === LOGIN ===
    Client->>Backend: POST /api/auth/login<br/>(username, password as form data)
    Backend->>DB: Query User by username
    DB-->>Backend: User row (or null)
    Backend->>Backend: verify_password(plain, hashed)
    alt Valid credentials + enabled=1
        Backend->>Backend: create_access_token(subject=user.id)
        Backend-->>Client: { access_token: "...", token_type: "bearer" }
        Backend->>DB: Background: UPDATE LAST_LOGIN, UPDATED_AT
    else Invalid
        Backend-->>Client: 401 Invalid credentials
    end

    Note over Client,DB: === SUBSEQUENT REQUESTS ===
    Client->>Backend: Authorization: Bearer <token>
    Backend->>Backend: jwt.decode(token, secret_key)
    Backend->>DB: Query User by id from JWT "sub"
    DB-->>Backend: User
    Backend->>Backend: Check RBAC (require_any_role)
    Backend-->>Client: Protected resource
```

---

## Authorization Model (RBAC)

```mermaid
graph LR
    subgraph Users
        U[User]
    end

    subgraph DirectRoles["Direct Roles"]
        R1[Role: dashboard_viewer]
        R2[Role: dashboard_editor]
        R3[Role: admin]
    end

    subgraph Groups
        G1[Group: viewers]
        G2[Group: editors]
    end

    subgraph GroupRoles["Group-Inherited Roles"]
        GR1[Role: dashboard_viewer]
        GR2[Role: dashboard_editor]
    end

    U -->|user_roles| R1
    U -->|user_roles| R2
    U -->|USER_GROUPS| G1
    U -->|USER_GROUPS| G2
    G1 -->|ROLE_GROUPS| GR1
    G2 -->|ROLE_GROUPS| GR2

    R1 --> Access1[Can VIEW dashboards]
    R2 --> Access2[Can EDIT dashboards + SQL]
    R3 --> Access3[Full admin access]
    GR1 --> Access1
    GR2 --> Access2
```

A user's effective roles = **direct roles ∪ group-inherited roles**. The `require_any_role()` dependency simply checks if the intersection of [user's effective roles] and [required roles] is non-empty.

---

## Data Flow: Dashboard Viewing

```mermaid
sequenceDiagram
    participant Client
    participant Backend
    participant DB as Oracle DB

    Client->>Backend: GET /api/dashboards/mine
    Backend->>Backend: get_current_user() → user.id
    Backend->>DB: SELECT d.*, last_opened<br/>FROM dashboards d<br/>JOIN user_dashboard_privs udp<br/>ON d.id = udp.dashboard_id<br/>AND udp.user_id = :user_id
    DB-->>Backend: List of dashboards
    Backend-->>Client: [{ id, name, description, last_opened }]

    Client->>Backend: GET /api/dashboards/{id}/tabs
    Backend->>DB: SELECT ID, NAME_, DISPLAY_ORDER<br/>FROM DASHBOARD_TABS<br/>WHERE DASHBOARD_ID = :id
    DB-->>Backend: Tab list
    Backend-->>Client: [{ tab_id, tab_name, display_order }]

    Client->>Backend: GET /api/dashboards/{id}/items?filters=...
    Backend->>DB: SELECT items from DASHBOARD_ITEMS
    loop For each item
        Backend->>DB: SELECT SQL_TEXT FROM SAVED_QUERIES WHERE ID = :sql_id
        Backend->>DB: SELECT filter metadata + bindings
        Backend->>Backend: Replace {{filter:key}} placeholders<br/>with parameterized predicates
        Backend->>DB: Execute final SQL with params
    end
    Backend-->>Client: [{ item_id, item_type, query_result, geometry, attributes }]

    Client->>Client: Parse geometry XML → {x,y,w,h}
    Client->>Client: Parse attributes XML → chart config
    Client->>Client: Instantiate chart class (Bar/Line/Pie)
    Client->>Client: Render to Canvas 2D
```

---

## Key Architectural Properties

| Property | Implementation | Notes |
|----------|---------------|-------|
| API Style | REST + OAuth2 form-encoded auth | Login/register use form-encoded, not JSON |
| Auth | JWT (HS256, 120 min expiry) | Stored in localStorage on frontend |
| AuthZ | RBAC via roles + groups | Direct and inherited role resolution |
| ORM | SQLAlchemy 2.0 declarative | Used for auth queries; raw SQL for dashboard items |
| Migrations | Alembic (configured, unused) | DB tables created via `Base.metadata.create_all()` on startup |
| Caching | None | No Redis, no in-memory cache |
| Background Tasks | FastAPI BackgroundTasks | Used for login timestamp updates and SQL audit logging |
| Error Handling | Try/except with HTTPException | No global exception handlers; errors returned as 500 with raw message |
| Logging | print() statements | No structured logging configured |
| Static Files | None served by backend | Frontend served separately by Vite |

---

## Deployment Model

```
Production:
  Frontend: npm run build → static files served by nginx/CDN
  Backend:  gunicorn app.main:app (or uvicorn with workers)

Development:
  Frontend: npm run dev → Vite :5173 (HMR, proxy to backend)
  Backend:  uvicorn app.main:app --reload :8000
```

The Vite proxy config maps `/api` and `/auth` paths to the backend, avoiding CORS issues in development. In production, a reverse proxy (nginx) handles this mapping.
