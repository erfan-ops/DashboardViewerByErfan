# Dashboard Viewer — Documentation

> Generated: 2026-06-07 | Confidence: HIGH

## What is this?

Dashboard Viewer is a **web-based dashboard viewing and editing application** — an OBIEE clone. It connects to an Oracle database, executes parameterized SQL queries, and renders data as interactive charts (bar, line, pie) on a Persian/RTL interface.

## Who is this for?

- **New developers** onboarding to the project
- **Existing developers** navigating the codebase
- **AI agents** understanding the architecture
- **Maintainers** planning changes

## Quick Start

```bash
# Backend
cd backend && uv sync && uv run python -m app.main

# Frontend
cd frontend && npm install && npm run dev

# Open http://localhost:5173
```

See [Development Guide](development_guide.md) for detailed setup instructions.

---

## Documentation Index

### Architecture & Overview

| Document | Content |
|----------|---------|
| [architecture.md](architecture.md) | System architecture, startup sequences, request lifecycle, auth flow, data flow |
| [diagrams/system_overview.md](diagrams/system_overview.md) | Component architecture, network architecture, data model, module dependency graph |
| [diagrams/dependency_graph.md](diagrams/dependency_graph.md) | Backend and frontend call graphs, fan-out modules, bottlenecks |
| [diagrams/request_lifecycle.md](diagrams/request_lifecycle.md) | Detailed request flows: dashboard viewing, authentication, filter application, SQL save |
| [diagrams/authentication_flow.md](diagrams/authentication_flow.md) | Login, registration, token validation, 401 handling, role resolution |
| [diagrams/frontend_architecture.md](diagrams/frontend_architecture.md) | Component tree, data fetching flow, chart rendering lifecycle, filter application |
| [diagrams/backend_architecture.md](diagrams/backend_architecture.md) | Module dependency graph, request processing pipeline, DB access patterns, authorization |
| [metadata/technology_stack.md](metadata/technology_stack.md) | Full technology stack, design decisions, architecture summary |

### Backend

| Document | Content |
|----------|---------|
| [backend/overview.md](backend/overview.md) | Backend architecture, module responsibilities, configuration, startup |
| [backend/api_endpoints.md](backend/api_endpoints.md) | Complete API reference — all endpoints with request/response examples |
| [backend/services.md](backend/services.md) | Business logic — auth, authorization, dashboards, SQL editor, filters |
| [backend/models.md](backend/models.md) | SQLAlchemy ORM models, Pydantic schemas, association tables |
| [backend/database.md](backend/database.md) | Connection, session management, query patterns, Oracle-specific features |
| [backend/authentication.md](backend/authentication.md) | JWT auth, BCrypt hashing, RBAC, token storage, security observations |

### Frontend

| Document | Content |
|----------|---------|
| [frontend/overview.md](frontend/overview.md) | Architecture, technology choices, rendering pipeline |
| [frontend/pages.md](frontend/pages.md) | All pages — HomePage, LoginPage, RegisterPage, EditorPage, ViewerPage |
| [frontend/components.md](frontend/components.md) | Shared components + chart class hierarchy |
| [frontend/routing.md](frontend/routing.md) | Route configuration, transitions, navigation methods |
| [frontend/state_management.md](frontend/state_management.md) | State architecture, data flow, auth state, anti-patterns |
| [frontend/api_integration.md](frontend/api_integration.md) | Axios setup, auth headers, error handling, API call inventory |
| [frontend/authentication.md](frontend/authentication.md) | Login flow, token storage, route protection, role-based UI |

### Modules

| Document | Content |
|----------|---------|
| [modules/module_dashboard_viewer.md](modules/module_dashboard_viewer.md) | Dashboard viewer, editor, auth, authorization, filter system, chart engine |

### Pitfalls & Hidden Knowledge

| Document | Content |
|----------|---------|
| [pitfalls/architecture.md](pitfalls/architecture.md) | No service layer, missing model columns, CORS, error handling |
| [pitfalls/backend.md](pitfalls/backend.md) | SQL injection risk, raw error messages, password in URL, race conditions |
| [pitfalls/frontend.md](pitfalls/frontend.md) | React lifecycle bugs, canvas responsiveness, dead code, typos, default credentials |
| [pitfalls/api.md](pitfalls/api.md) | Rate limiting, SELECT validation, N+1 queries, no API versioning |
| [pitfalls/authentication.md](pitfalls/authentication.md) | JWT in localStorage, no refresh tokens, weak secret, no password rules |
| [pitfalls/performance.md](pitfalls/performance.md) | N+1 queries, connection pool, eager loading, no caching, bundle size |
| [pitfalls/troubleshooting_patterns.md](pitfalls/troubleshooting_patterns.md) | Common issues and diagnostic steps |

### Operations

| Document | Content |
|----------|---------|
| [development_guide.md](development_guide.md) | Local setup, running, debugging, testing |
| [deployment.md](deployment.md) | Production deployment, Docker, nginx config |
| [troubleshooting.md](troubleshooting.md) | Quick diagnostic checklist, common issues |

### Metadata

| Document | Content |
|----------|---------|
| [metadata/project_inventory.md](metadata/project_inventory.md) | Directory structure, entry points, configuration files, DB schema inventory |
| [metadata/dependency_inventory.md](metadata/dependency_inventory.md) | All dependencies with usage, import graphs, dead code |
| [metadata/technology_stack.md](metadata/technology_stack.md) | Technology stack summary |

---

## System at a Glance

```
React 18 (TypeScript)  ←→  FastAPI (Python 3.10)  ←→  Oracle DB
    (Vite :5173)              (Uvicorn :8000)           (192.168.1.42:1521)
```

- **Frontend:** Chakra UI, React Router v6, custom Canvas 2D charts, Persian/RTL
- **Backend:** JWT auth (HS256), RBAC (roles + groups), raw SQL + ORM
- **Database:** Oracle with 15+ tables, parameterized dynamic SQL filtering

## Known Issues Summary

| Severity | Issue | Location |
|----------|-------|----------|
| **High** | Dashboard `spec` and `owner_id` not persisted | `db/models.py`, `api/dashboards.py` |
| **High** | `messure` typo breaks pie chart measure parsing | `core/utils.ts` line 401 |
| **Medium** | JWT in localStorage (XSS risk) | `LoginPage.tsx`, `ProtectedRoute.tsx` |
| **Medium** | N+1 queries in dashboard items endpoint | `api/dashboards.py` |
| **Medium** | Default credentials in LoginPage | `LoginPage.tsx` |
| **Medium** | CORS allows all origins | `main.py` |
| **Low** | Several dead code / unused imports | Both frontend and backend |

Full details: see [pitfalls/](pitfalls/) directory.

---

## Data Flow Summary

1. **User logs in** → JWT stored in localStorage → sent with every request
2. **HomePage loads** → fetches user's dashboards + roles from backend
3. **User clicks dashboard** → ViewerPage fetches tabs, items (with SQL data), filter groups
4. **Backend resolves items** → For each item: fetches SQL from SAVED_QUERIES, resolves filters, executes parameterized query
5. **Frontend renders** → Parses XML geometry/attributes → instantiates ChartItem class → renders to Canvas 2D
6. **User applies filter** → Frontend sends filter values → Backend replaces `{{filter:key}}` placeholders → re-executes SQL → re-renders charts

## Contributing

Before making changes, review:
1. [architecture.md](architecture.md) — Understand the system
2. [pitfalls/](pitfalls/) — Know the existing issues
3. [development_guide.md](development_guide.md) — Set up locally

## Confidence Levels

This documentation was generated through thorough code analysis. Sections marked **HIGH** confidence are directly derived from code. Sections marked **MEDIUM** confidence involve reasonable inference but could not be fully verified (e.g., deployment assumptions without existing deployment scripts).
