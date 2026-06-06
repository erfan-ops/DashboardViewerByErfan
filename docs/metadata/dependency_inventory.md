# Dependency Inventory

> Generated: 2026-06-07 | Confidence: HIGH

## Backend Dependencies

### Runtime Dependencies

| Package | Version Constraint | Why It's Used | Imported In |
|---------|-------------------|---------------|-------------|
| fastapi | ≥0.114.0 | Web framework; routing, DI, middleware, OpenAPI | `main.py`, all `api/*.py` |
| uvicorn[standard] | ≥0.30.0 | ASGI server with hot reload | `main.py` (run function) |
| pydantic-settings | ≥2.4.0 | `.env` file configuration management | `core/config.py` |
| python-jose[cryptography] | ≥3.3.0 | JWT encoding/decoding (HS256) | `core/security.py`, `api/auth.py` |
| passlib[bcrypt] | ≥1.7.4 | BCrypt password hashing abstraction | `core/security.py` |
| sqlalchemy | ≥2.0.30 | ORM; engine, session, declarative models, text() SQL | `db/*.py`, all `api/*.py` |
| oracledb | ≥2.2.1 | Oracle database driver (thin mode) | `db/session.py` |
| alembic | ≥1.13.2 | Database migrations (configured, not actively used) | — |
| python-multipart | ≥0.0.9 | OAuth2 form-encoded request body parsing | `api/auth.py` |
| email-validator | ≥2.3.0 | Email address validation in registration | `api/auth.py` |
| gunicorn | ≥23.0.0 | Production WSGI server | — |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| pytest | ≥8.0.0 | Testing framework |
| httpx | ≥0.27.0 | HTTP test client for FastAPI |

---

## Frontend Dependencies

### Runtime Dependencies

| Package | Version | Why It's Used | Imported In |
|---------|---------|---------------|-------------|
| react | ^18.3.1 | UI component library | All pages and components |
| react-dom | ^18.3.1 | DOM rendering | `main.tsx` |
| @chakra-ui/react | ^2.8.2 | Component library, theming, color mode | All pages |
| @chakra-ui/icons | ^2.1.1 | Built-in icon components (MoonIcon, SunIcon) | `ThemeToggle.tsx` |
| @emotion/react | ^11.11.4 | CSS-in-JS runtime (Chakra dependency) | — (indirect) |
| @emotion/styled | ^11.11.5 | Styled component API (Chakra dependency) | — (indirect) |
| react-router-dom | ^6.28.0 | Client-side routing (createBrowserRouter) | `main.tsx`, `ProtectedRoute.tsx`, pages |
| @tanstack/react-query | ^5.59.0 | Server state management, caching | `main.tsx` (QueryClient initialized) |
| axios | ^1.7.2 | HTTP client with interceptors | `main.tsx`, all pages |
| @monaco-editor/react | ^4.6.0 | Monaco code editor for SQL | `EditorPage.tsx` |
| echarts | ^5.5.0 | **Bundled but NOT used** — charts are custom Canvas 2D | `ViewerPage.tsx` (imported, unused) |
| react-icons | ^5.5.0 | Feather icon components | `HomePage.tsx` |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @types/react | ^18.2.66 | React TypeScript types |
| @types/react-dom | ^18.2.22 | ReactDOM TypeScript types |
| @vitejs/plugin-react | ^5.1.0 | Vite React plugin (Fast Refresh) |
| typescript | ^5.5.4 | TypeScript compiler (noEmit mode) |
| vite | ^7.1.12 | Build tool, dev server, HMR |

---

## Dependency Graph (How Modules Depend on Each Other)

### Backend Import Graph

```
main.py
├── core/config.py         ← pydantic-settings
├── core/security.py       ← python-jose, passlib, config
├── db/models.py           ← sqlalchemy (Base imported directly)
├── db/session.py          ← sqlalchemy, oracledb, config
├── db/raw.py              ← sqlalchemy (shared raw-SQL helper)
├── api/routes.py
│   ├── api/auth.py        ← security.py, config, db/session, db/models, schemas
│   ├── api/editor.py      ← deps.py, db/session
│   ├── api/dashboards.py   ← deps.py, db/session, db/models, services/filter_service
│   ├── api/user.py        ← deps.py, auth.py, db/models
│   └── api/deps.py        ← auth.py, db/models, db/session, services/authorization_service
├── services/
│   ├── filter_service.py     ← (pure logic, no DB deps)
│   └── authorization_service.py ← db/models
└── schemas.py             ← pydantic
```

### Key Dependency Observations

1. **`api/deps.py`** is the central authorization hub — imported by `dashboards.py`, `editor.py`, `user.py`
2. **`api/auth.py`** is imported by `routes.py` and `deps.py`, and from `user.py` via `get_current_user`
3. **`core/config.py`** is a leaf — depended on by `session.py`, `security.py`, and `auth.py`
4. **`db/session.py`** is the most-depended-on module — every API endpoint and `deps.py` needs `get_db`
5. **`db/models.py`** is imported by `base.py`, `auth.py`, `dashboards.py`, `deps.py`, `user.py`

### Frontend Import Graph

```
main.tsx
├── theme.ts               ← @chakra-ui/react
├── ProtectedRoute.tsx      ← react-router-dom
├── ThemeToggle.tsx         ← @chakra-ui/react + icons
├── pages/LoginPage.tsx     ← axios, ThemeToggle
├── pages/RegisterPage.tsx  ← axios, ThemeToggle
├── pages/HomePage.tsx      ← axios, core/utils
├── pages/EditorPage.tsx    ← axios, @monaco-editor, ThemeToggle
└── pages/ViewerPage.tsx    ← axios, core/BarChartItem, core/LineChartItem,
                               core/PieChartItem, core/utils,
                               components/BarChartCanvas, components/LineChartCanvas,
                               components/PieChartCanvas, types/dashboard
    ├── components/BarChartCanvas.tsx  ← core/BarChartItem
    ├── components/LineChartCanvas.tsx ← core/LineChartItem
    ├── components/PieChartCanvas.tsx  ← core/PieChartItem, core/utils
    ├── core/BarChartItem.ts  ← core/DashboardItem, core/utils
    ├── core/LineChartItem.ts ← core/DashboardItem, core/utils
    ├── core/PieChartItem.ts  ← core/DashboardItem, core/utils
    ├── core/DashboardItem.ts ← (abstract base)
    ├── core/utils.ts         ← (leaf utility)
    └── types/dashboard.ts    ← (leaf types)
```

### High Fan-Out Modules

| Module | Imported By | Risk |
|--------|------------|------|
| `db/session.py` | 6 modules | Changes to DB connection affect everything |
| `api/deps.py` | 3 modules | Authorization changes break all protected endpoints |
| `core/utils.ts` | 4 modules | Chart rendering depends on shared utilities |
| `core/DashboardItem.ts` | 3 modules | Base class for all chart types |

### Dead/Dormant Code

| Location | Issue |
|----------|-------|
| `echarts` import in `ViewerPage.tsx` | Imported but never used — `import { color } from 'echarts'` is unused |
| `OAuth2Form` in `backend/app/schemas.py` | Defined but not used — login uses Form() params directly |
| `LoginRequest` in `backend/app/schemas.py` | Defined but not used — login uses Form() params |
| `render_webgl()` in `PieChartItem.ts` | Empty stub — "WebGL path not implemented in this example" |
| `lightenColorHex2Hex` in `core/utils.ts` | Defined but never called anywhere |
