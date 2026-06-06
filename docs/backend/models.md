# Backend Models (Pydantic + SQLAlchemy ORM)

> Generated: 2026-06-07 | Confidence: HIGH

## Overview

The backend uses two model layers:
1. **SQLAlchemy ORM models** (`db/models.py`) — Map to Oracle database tables
2. **Pydantic models** (`schemas.py`) — Request/response serialization

---

## SQLAlchemy ORM Models

### Base

```python
class Base(DeclarativeBase):
    pass
```

All ORM models inherit from `Base`. Association tables use `Base.metadata` directly.

---

### User

**Table:** `users`

| Column | Python Type | Oracle Column | Constraints |
|--------|------------|---------------|-------------|
| id | int | ID | PK, indexed |
| username | str | USERNAME | String(50) |
| email | str | EMAIL | String(100), unique, indexed |
| password_hash | str | PASSWORD_HASH | String(255) |
| created_at | datetime | CREATED_AT | server_default=now() |
| updated_at | datetime\|None | UPDATED_AT | nullable |
| last_login | datetime\|None | LAST_LOGIN | nullable |
| enabled | int | ENABLED | 1/0 flag |
| role | str | ROLE | String(255), legacy column |

**Relationships:**
- `roles` → M2M to `Role` via `user_roles` table (lazy="joined")
- `groups` → M2M to `Group` via `USER_GROUPS` table (lazy="joined")
- `dashboards` → M2M to `Dashboard` via `USER_DASHBOARD_PRIVS` table (lazy="joined")

**NOTE:** The `role` column (String(255)) is a legacy flat role field. The actual RBAC system uses the separate `roles` relationship via the `user_roles` association table. The `role` column appears to be a simpler alternative that stores a flat role name directly on the user row (e.g., "ROLE_USER").

---

### Role

**Table:** `roles`

| Column | Python Type | Constraints |
|--------|------------|-------------|
| id | int | PK |
| name | str | String(100), unique, indexed |
| description | str | String(255), default="" |

**Relationships:**
- `users` → M2M to `User` via `user_roles`
- `groups` → M2M to `Group` via `ROLE_GROUPS`

---

### Group

**Table:** `groups`

| Column | Python Type | Constraints |
|--------|------------|-------------|
| id | int | PK |
| name | str | String(100), unique, indexed |
| description | str | String(255), default="" |

**Relationships:**
- `users` → M2M to `User` via `USER_GROUPS`
- `roles` → M2M to `Role` via `ROLE_GROUPS`

---

### Dashboard

**Table:** `dashboards`

| Column | Python Type | Constraints |
|--------|------------|-------------|
| id | int | PK |
| name | str | String(100), indexed |
| description | str | String(255) |

**Relationships:**
- `users` → M2M to `User` via `USER_DASHBOARD_PRIVS` (lazy="joined")

**NOTE:** The Dashboard model does NOT include a `spec` column (JSON), but `save_dashboard()` accepts a `spec` dict. Looking at the endpoint code in `dashboards.py` line 86: `Dashboard(name=payload.name, spec=payload.spec, owner_id=user.id)` — this uses `spec` and `owner_id` which are NOT defined as mapped columns on the Dashboard model. This would cause an error at runtime unless the database columns exist but are not mapped in the model.

---

### SavedQuery

**Table:** `saved_queries`

| Column | Python Type | Constraints |
|--------|------------|-------------|
| id | int | PK |
| owner_id | int | FK → users.ID |
| name | str | String(255), indexed |
| sql_text | str | Text |
| created_at | datetime | server_default=now() |
| updated_at | datetime | server_default=now(), onupdate=now() |

---

## Association Tables (No ORM class)

### user_roles
| Column | References |
|--------|-----------|
| user_id (PK) | users.ID |
| role_id (PK) | roles.id |

### USER_GROUPS
| Column | References |
|--------|-----------|
| USER_ID (PK) | users.ID |
| GROUP_ID (PK) | groups.id |

### ROLE_GROUPS
| Column | References |
|--------|-----------|
| ROLE_ID (PK) | roles.id |
| GROUP_ID (PK) | groups.id |

### USER_DASHBOARD_PRIVS
| Column | References |
|--------|-----------|
| USER_ID (PK) | users.ID |
| DASHBOARD_ID (PK) | dashboards.id |
| LAST_OPENED | (additional column) |

---

## Unmapped Tables

These tables are accessed via raw SQL (`text()`) and do NOT have ORM models:

| Table | Accessed In |
|-------|------------|
| `DASHBOARD_ITEMS` | `dashboards.py:get_dashboard_items` |
| `DASHBOARD_TABS` | `dashboards.py:get_dashboard_tabs` |
| `DASHBOARD_FILTERS` | `dashboards.py:get_dashboard_items`, `get_dashboard_filter_groups` |
| `DASHBOARD_FILTER_BINDINGS` | `dashboards.py:get_dashboard_items` |
| `DASHBOARD_FILTER_GROUPS` | `dashboards.py:get_dashboard_filter_groups` |
| `DASHBOARD_FILTER_GROUP_MEMBERS` | `dashboards.py:get_dashboard_filter_groups` |
| `SAVED_QUERIES_UPDATE_LOG` | `editor.py:save_sql` (background task) |

---

## Pydantic Models

### Request Models

| Model | Location | Fields |
|-------|----------|--------|
| `DashboardSaveRequest` | dashboards.py | name: str, spec: dict |
| `ExecuteSQLRequest` | editor.py | sql: str, limit: int\|None = 1000 |
| `SaveSQLRequest` | editor.py | name: str, sql: str |
| `UserRegisterRequest` | auth.py | username, email, password, confirm_password |
| `LoginRequest` | schemas.py | username: str, password: str |
| `OAuth2Form` | schemas.py | username: str, password: str |

### Response Models

| Model | Location | Fields |
|-------|----------|--------|
| `Token` | schemas.py | access_token: str, token_type: str = "bearer" |
| `UserOut` | schemas.py | id, email, username, enabled, role |
| `RoleOut` | schemas.py | id, name, description |
| `GroupOut` | schemas.py | id, name, description |
| `DashboardOut` | dashboards.py | id: int, name: str, description: str |
| `MyDashboardOut` | dashboards.py | id, name, description, last_opened: str\|None |
| `DashboardItemOut` | dashboards.py | id, dashboard_id, item_type, display_order, geometry, attributes, sql_id |
| `DashboardItemResult` | dashboards.py | item_id, item_type, display_order, geometry, attributes, query_result, tab_id |
| `DashboardTabResult` | dashboards.py | tab_id, tab_name, display_order |
| `DashboardFilterResult` | dashboards.py | filter_id, name, filter_key, operator_type, data_type, default_value, allow_empty |
| `DashboardFilterGroupResult` | dashboards.py | group_id, name, position, tab_id, filters: List[FilterResult] |
| `QueryResult` | dashboards.py | columns: List[str], rows: List[List[Any]] |

### Dead/Unused Models

- `LoginRequest` — Defined in `schemas.py` but never used (login uses `Form()` params)
- `OAuth2Form` — Defined in `schemas.py` but never used
- `UserRegisterRequest` — Defined in `auth.py` but never used (register uses `Form()` params)
- `DashboardItemOut` — Defined but never used as response_model
- `RoleOut`, `GroupOut` — Defined but never used
