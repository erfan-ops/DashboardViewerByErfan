# Technology Stack

> Generated: 2026-06-07 | Confidence: HIGH

## Overview

This project is a **dashboard viewer and editor application** — effectively an OBIEE clone — composed of a FastAPI backend and a React/TypeScript frontend, backed by an Oracle database.

---

## Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | FastAPI | ≥0.114.0 | REST API server, async request handling |
| ASGI Server | Uvicorn | ≥0.30.0 | Development/production ASGI server with hot reload |
| WSGI Server (prod) | Gunicorn | ≥23.0.0 | Production WSGI server |
| ORM | SQLAlchemy | ≥2.0.30 | ORM for Oracle database access |
| DB Driver | oracledb | ≥2.2.1 | Oracle database driver (thin mode) |
| Migrations | Alembic | ≥1.13.2 | Schema migrations (configured, not actively used) |
| Configuration | pydantic-settings | ≥2.4.0 | `.env` file based settings management |
| Auth — JWT | python-jose | ≥3.3.0 | JWT token encoding/decoding |
| Auth — Hashing | passlib[bcrypt] | ≥1.7.4 | BCrypt password hashing (rounds=12) |
| Form Parsing | python-multipart | ≥0.0.9 | OAuth2 form-encoded body parsing |
| Validation | email-validator | ≥2.3.0 | Email address validation |

**Language:** Python 3.10+
**Package Manager:** uv (with uv.lock)

---

## Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | ^18.3.1 | UI component library |
| Language | TypeScript | ^5.5.4 | Typed JavaScript |
| Build Tool | Vite | ^7.1.12 | Dev server, bundler, HMR |
| UI Library | Chakra UI | ^2.8.2 | Component library, theming, accessibility |
| Icons (Chakra) | @chakra-ui/icons | ^2.1.1 | Built-in Chakra icon set |
| CSS-in-JS | @emotion/react + @emotion/styled | ^11.11.x | Runtime styling for Chakra |
| Routing | react-router-dom | ^6.28.0 | Client-side routing |
| Server State | @tanstack/react-query | ^5.59.0 | Data fetching, caching, synchronization |
| HTTP Client | axios | ^1.7.2 | HTTP requests with interceptors |
| Code Editor | @monaco-editor/react | ^4.6.0 | Monaco SQL editor component |
| Charting (bundled) | echarts | ^5.5.0 | **NOTE:** Imported but unused — charts are custom Canvas 2D |
| Icons | react-icons | ^5.5.0 | Icon library (Feather icons used) |
| Fonts | Vazir v18 + Yekan | — | Persian/Arabic script fonts, loaded via @font-face |

**Package Manager:** npm (package-lock.json present)

---

## Database

| Component | Technology | Version/Detail |
|-----------|-----------|----------------|
| RDBMS | Oracle Database | Accessible at `192.168.1.42:1521` |
| Service Name | pdb.oracle.ek | Pluggable database |
| Driver | oracledb (thin) | Via SQLAlchemy `oracle+oracledb://` |

---

## Development Tools

| Tool | Purpose |
|------|---------|
| pytest | Backend testing framework |
| httpx | HTTP test client for FastAPI |
| Vite Dev Server | Frontend dev server with HMR on port 5173 |
| Vite Proxy | `/api` and `/auth` proxied to backend at `127.0.0.1:8000` |

---

## Architecture Summary

```
┌─────────────────────┐     ┌──────────────────────┐
│   React Frontend    │────▶│   FastAPI Backend     │
│   (Vite :5173)      │     │   (Uvicorn :8000)     │
│                     │◀────│                       │
│ Chakra UI + Canvas  │     │ JWT Auth + RBAC       │
└─────────────────────┘     └───────────┬───────────┘
                                        │
                                        │ oracle+oracledb
                                        ▼
                             ┌──────────────────────┐
                             │   Oracle Database     │
                             │   192.168.1.42:1521   │
                             │   pdb.oracle.ek       │
                             └──────────────────────┘
```

---

## Key Design Decisions

1. **Custom Canvas 2D Charts** — Bar, Line, and Pie charts are hand-rendered on HTML Canvas instead of using echarts. The `echarts` package is a dependency but not used in the rendering pipeline. This gives full control over Persian digit formatting and RTL layout.

2. **Oracle-First Schema** — The SQLAlchemy models use Oracle-style column names (e.g., `"ID"`, `"USERNAME"`) and raw SQL via `text()` for complex queries. The app ships with hardcoded sequences (`user_id_seq.nextval`, `saved_queries_id_seq.nextval`).

3. **OAuth2 Form-Encoded Login** — Both login and register endpoints accept `application/x-www-form-urlencoded` (OAuth2 password flow style), not JSON.

4. **RBAC via Roles, Groups, and Association Tables** — Three-level permissions: Users can have direct Roles, be members of Groups, and Groups can have Roles. Access control uses `require_any_role()` dependency.

5. **Dynamic SQL Filtering** — Dashboard items contain `{{filter:key}}` placeholders in SQL that are replaced server-side with user-provided filter values, supporting IN, BETWEEN, LIKE, and comparison operators.

6. **Persian/RTL UI** — The frontend renders in Persian (Farsi) with RTL direction, custom Persian digit conversion (`toPersianDigits`), and Persian fonts (Vazir, Yekan).
