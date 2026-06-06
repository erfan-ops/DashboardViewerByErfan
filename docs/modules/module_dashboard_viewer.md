# Module: Dashboard Viewer

> Generated: 2026-06-07 | Confidence: HIGH

## Purpose

The Dashboard Viewer module is the **core feature** of the application. It allows users to view dashboards composed of SQL-backed chart visualizations (bar, line, pie) organized into tabs with runtime filters.

---

## Backend Files

| File | Role |
|------|------|
| `app/api/dashboards.py` | All dashboard endpoints (CRUD, items, tabs, filters) |
| `app/db/models.py` | `Dashboard` ORM model |
| `app/api/deps.py` | Authorization for dashboard access |

## Frontend Files

| File | Role |
|------|------|
| `src/pages/ViewerPage.tsx` | Dashboard viewer page (tabs, filters, chart dispatch) |
| `src/core/BarChartItem.ts` | Bar chart Canvas 2D renderer |
| `src/core/LineChartItem.ts` | Line chart Canvas 2D renderer |
| `src/core/PieChartItem.ts` | Pie chart Canvas 2D renderer |
| `src/core/DashboardItem.ts` | Abstract base class for all charts |
| `src/core/utils.ts` | Chart utilities (XML parsing, Persian digits, colors) |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/dashboards/` | Create dashboard |
| GET | `/api/dashboards/mine` | List user's dashboards |
| GET | `/api/dashboards/{id}` | Get dashboard metadata |
| GET | `/api/dashboards/{id}/items` | Get items with SQL data |
| GET | `/api/dashboards/{id}/tabs` | Get tab definitions |
| GET | `/api/dashboards/{id}/filter-groups` | Get filter group definitions |

## Data Flow

```
User clicks dashboard on HomePage
  → Navigate to /viewer/:id
    → Fetch tabs, items, filter groups (parallel)
      → Items: for each item, resolve SQL + filters → execute → return data
        → Frontend: parse geometry + attributes XML → instantiate chart → render Canvas 2D
```

## Dependencies

- **Requires:** Authentication (JWT), Authorization (RBAC), Database (Oracle, SAVED_QUERIES, DASHBOARD_ITEMS, DASHBOARD_TABS, DASHBOARD_FILTERS)
- **Required by:** (nothing — this is the primary consumer module)

---

## Module: Dashboard Editor

### Purpose

The Dashboard Editor module allows authorized users to write, execute, save, and manage SQL queries that power dashboard items.

### Backend Files

| File | Role |
|------|------|
| `app/api/editor.py` | SQL execute, save, list endpoints |

### Frontend Files

| File | Role |
|------|------|
| `src/pages/EditorPage.tsx` | Monaco SQL editor with saved queries sidebar |

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/editor/sql/execute` | Execute SELECT query |
| POST | `/api/editor/sql/save` | Save/update named SQL |
| GET | `/api/editor/sql/saved` | List saved queries |

### Dependencies

- **Requires:** Authentication + `dashboard_editor` or `admin` role
- **Required by:** Dashboard Viewer (consumes SAVED_QUERIES)

---

## Module: Authentication

### Purpose

User authentication via JWT tokens, registration, and role resolution.

### Backend Files

| File | Role |
|------|------|
| `app/api/auth.py` | Login, register, token validation |
| `app/core/security.py` | BCrypt hashing, JWT creation |
| `app/core/config.py` | JWT settings |

### Frontend Files

| File | Role |
|------|------|
| `src/pages/LoginPage.tsx` | Login form |
| `src/pages/RegisterPage.tsx` | Registration form |
| `src/components/ProtectedRoute.tsx` | Auth guard |
| `src/main.tsx` | 401 interceptor |

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |

### Dependencies

- **Requires:** Database (USERS table, Oracle sequences), BCrypt, python-jose
- **Required by:** All protected modules

---

## Module: Authorization (RBAC)

### Purpose

Role-based access control using roles, groups, and inheritance.

### Backend Files

| File | Role |
|------|------|
| `app/api/deps.py` | `require_any_role()` dependency factory |
| `app/db/models.py` | User, Role, Group models + association tables |

### Frontend Files

| File | Role |
|------|------|
| `src/pages/HomePage.tsx` | Role-aware UI (editor button visibility) |

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/roles` | Get current user's effective roles |

### Role Hierarchy

```
User
├── Direct Roles (user_roles)
└── Groups (USER_GROUPS)
    └── Group Roles (ROLE_GROUPS)
```

Effective roles = direct roles ∪ group-inherited roles

---

## Module: Filter System

### Purpose

Dynamic SQL filtering system that allows dashboard users to apply runtime filters to chart data.

### Backend Location

Entirely within `app/api/dashboards.py`:
- `FILTER_PLACEHOLDER_RE` = `r"\{\{\s*filter:([^\}\s]+)\s*\}\}"`
- `filter_replacer()` inner function
- Filter metadata queries from `DASHBOARD_FILTERS` + `DASHBOARD_FILTER_BINDINGS`

### Database Tables

- `DASHBOARD_FILTERS` — Filter definitions (key, operator, data_type, default, allow_empty)
- `DASHBOARD_FILTER_BINDINGS` — Binds filters to SQL queries (logical_column)
- `DASHBOARD_FILTER_GROUPS` — UI grouping of filters
- `DASHBOARD_FILTER_GROUP_MEMBERS` — Maps filters to groups

### Filter Resolution Algorithm

```
For each {{filter:key}} in SQL:
  1. Look up filter metadata (operator, default, allow_empty, logical_column)
  2. Check user-provided value
     ├── Has value → Generate predicate (col OP :param)
     ├── No value, has default → Use default
     ├── No value, allow_empty → Skip filter (return "")
     └── No value, not allow_empty → Return "AND 1=0"
  3. Replace placeholder with generated SQL
```

### Supported Operators

=, >, <, >=, <=, <>, IN, BETWEEN, LIKE

---

## Module: Chart Engine

### Purpose

Custom Canvas 2D chart rendering with Persian digit support.

### Files

| File | Chart Type | Lines |
|------|-----------|-------|
| `src/core/DashboardItem.ts` | Abstract base | ~27 |
| `src/core/BarChartItem.ts` | Stacked bar | ~477 |
| `src/core/LineChartItem.ts` | Multi-line with gradient | ~240 |
| `src/core/PieChartItem.ts` | Multi-pie donut grid | ~476 |
| `src/core/utils.ts` | Utilities + XML parsers | ~429 |

### Class Hierarchy

```
DashboardItem (abstract)
  ├── render(hoveredIndex): void — abstract
  ├── getSliceAtCursor(x, y) → hit test result
  └── helpers (color conversion, lightening, rounding)
```

### Rendering Features Shared Across Charts
- Persian digit conversion (`toPersianDigits`)
- Thousand separator formatting (Persian comma)
- XML attribute parsing with full defaults
- Hover highlighting + tooltip support
- Hit testing for interactive regions
