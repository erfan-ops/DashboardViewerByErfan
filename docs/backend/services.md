# Backend Services & Business Logic

> Generated: 2026-06-07 | Confidence: HIGH

## Important Note

The application has a **thin service layer** (created during structural cleanup). Business logic for filter resolution and authorization has been extracted from API endpoint functions into dedicated service modules. The sections below document all services — both physical modules in `app/services/` and logical services still embedded in API modules.

---

## Authentication Service

**Location:** `app/api/auth.py`

### Functions

#### `get_current_user(db, token) → User`
Validates a JWT token and returns the authenticated User. This is the core authentication dependency used by all protected endpoints.

1. Decodes the JWT using `python-jose` with the configured secret key and algorithm
2. Extracts `sub` claim (user ID)
3. Fetches the User from the database by ID
4. Returns the User object (or raises 401)

**Used by:** `require_any_role()` in `deps.py`, all protected endpoints

#### `login(username, password, background_tasks, db) → Token`
Authenticates a user with username + password.

1. Queries User by username
2. Validates: user exists, `enabled == 1`, password matches BCrypt hash
3. Creates a JWT access token with subject = user.id
4. Schedules a background task to update `LAST_LOGIN` and `UPDATED_AT` timestamps
5. Returns `{ access_token, token_type: "bearer" }`

#### `register(username, email, password, confirm_password, db) → {status: "ok"}`
Registers a new user.

1. Checks username uniqueness (409 if exists)
2. Checks email uniqueness (409 if exists)
3. Validates password == confirm_password (401 if mismatch)
4. Hashes password with BCrypt (rounds=12)
5. Inserts into USERS table using raw SQL with `user_id_seq.nextval`
6. Assigns role "ROLE_USER"

---

## Authorization Service

**Location:** `app/services/authorization_service.py` (business logic), `app/api/deps.py` (FastAPI dependency wiring)

### `get_user_role_names(user, db) → Set[str]`
Resolves all effective role names for a user (direct roles + group-inherited). Exported from `services/authorization_service.py`.

### `normalize_role(name) → str`
Normalizes a role name for case-insensitive comparison. Exported from `services/authorization_service.py`.

### `require_any_role(*role_names) → Callable → User`
FastAPI dependency factory (in `api/deps.py`). Delegates to `get_user_role_names()` from the authorization service.

---

## Dashboard Service

**Location:** `app/api/dashboards.py`

### Dashboard CRUD

| Function | Purpose |
|----------|---------|
| `save_dashboard(name, spec, db, user)` | Creates a new Dashboard with JSON spec |
| `list_my_dashboards(db, user)` | Lists dashboards accessible to the user with last_opened timestamps |
| `get_dashboard(dashboard_id, db, user)` | Gets a single dashboard by ID |

### Filter Resolution Service

**Location:** `app/services/filter_service.py` (extracted from `api/dashboards.py`)

#### `resolve_filters(raw_sql_text, filter_rows, provided_filters) -> (str, dict)`

Replaces `{{filter:key}}` placeholders in SQL text with parameterized predicates. This is a pure function with no database or HTTP dependencies — independently testable.

**Value Resolution Precedence:**
1. User-provided filter value (from query string)
2. Default value (from `DASHBOARD_FILTERS.default_value`)
3. If `allow_empty`: skip filter entirely
4. If not `allow_empty` and no value: return `AND 1 = 0` (no rows)

### Dashboard Items

`get_dashboard_items(dashboard_id, filters, db, user)` — The endpoint now delegates filter resolution to `resolve_filters()` rather than handling it inline.

**Algorithm:**
1. Parse `filters` JSON from query string
2. Query `DASHBOARD_ITEMS` for the dashboard
3. For each item:
   a. Look up `SQL_TEXT` from `SAVED_QUERIES` by `SQL_ID`
   b. Validate it's a SELECT statement
   c. Look up filter metadata from `DASHBOARD_FILTERS` + `DASHBOARD_FILTER_BINDINGS`
   d. **Call `resolve_filters(raw_sql_text, filter_rows, provided_filters)`**
   e. Execute the returned SQL with returned params

**Supported Filter Operators:**

| Operator | Behavior | Example |
|----------|----------|---------|
| `=` | Equality | `col = :param` |
| `>` | Greater than | `col > :param` |
| `<` | Less than | `col < :param` |
| `>=` | Greater or equal | `col >= :param` |
| `<=` | Less or equal | `col <= :param` |
| `<>` | Not equal | `col <> :param` |
| `IN` | List membership | `col IN (:p_0, :p_1, :p_2)` |
| `BETWEEN` | Range (2 values) | `col BETWEEN :p_1 AND :p_2` |
| `LIKE` | Pattern match | `col LIKE :param` |
| default | Falls back to equality | `col = :param` |

**Value Resolution Precedence:**
1. User-provided filter value (from query string)
2. Default value (from `DASHBOARD_FILTERS.default_value`)
3. If `allow_empty`: skip filter entirely
4. If not `allow_empty` and no value: return `AND 1 = 0` (no rows)

### Dashboard Tabs

`get_dashboard_tabs(dashboard_id, db, user)` — Returns tabs ordered by `DISPLAY_ORDER`.

### Dashboard Filter Groups

`get_dashboard_filter_groups(dashboard_id, db, user)` — Returns filter groups with their member filters, including position (XML), so the frontend can render them as positioned overlays.

**NOTE:** The response_model annotation on this endpoint declares `response_model=DashboardFilterGroupResult` (singular) but returns `list(groups.values())` (plural). This is likely a bug — the annotation should be `List[DashboardFilterGroupResult]`.

---

## Raw SQL Helper

**Location:** `app/db/raw.py`

Centralises the `db.bind.connect()` pattern that was duplicated across `auth.py`, `dashboards.py`, and `editor.py`. Provides three helpers:

- `execute(sql, db, params)` — Execute and return cursor result
- `execute_and_fetch(sql, db, params)` — Execute SELECT and return all rows
- `execute_and_commit(sql, db, params)` — Execute INSERT/UPDATE/DELETE and commit

---

## SQL Editor Service

**Location:** `app/api/editor.py`

### `execute_sql(sql, limit, db, user) → {columns, rows}`
Executes a user-provided SQL query.

1. Validates the SQL starts with "SELECT" (case-insensitive)
2. Appends `FETCH FIRST N ROWS ONLY` (default 1000)
3. Executes via raw `text()` statement
4. Returns column names and row data

**Security:** Only SELECT statements are allowed. However, there is no further validation or sanitization — the SQL is executed as-is. This means users with `dashboard_editor` or `admin` roles can execute arbitrary SELECT queries against the Oracle database, potentially accessing any table they have Oracle-level privileges for.

### `save_sql(name, sql, background_tasks, db, user) → {success, updated/created}`
Saves or updates a SQL query.

1. Checks if a query with the same name already exists
2. **If exists:** Updates `SQL_TEXT`, schedules background task to set `UPDATED_AT` and log the change
3. **If new:** Inserts with `saved_queries_id_seq.nextval`
4. The background task only runs if the SQL text actually changed

### `get_saved_queries(db, user) → {queries: [...]}`
Returns all saved queries ordered by `CREATED_AT DESC`.

---

## User Service

**Location:** `app/api/user.py`

### `get_user_roles(user, db) → Set[str]`
Returns the current user's effective role names (direct + group-inherited).

This is a lightweight endpoint used by the frontend to conditionally show admin/editor UI elements.

---

## Data Flow: Dashboard Rendering

```
ViewerPage mounts
  ├─ GET /api/dashboards/{id}           → dashboard metadata
  ├─ GET /api/dashboards/{id}/tabs      → tab list
  ├─ GET /api/dashboards/{id}/filter-groups → filter configuration
  └─ GET /api/dashboards/{id}/items     → chart data
       │
       ├─ Query DASHBOARD_ITEMS
       ├─ For each item:
       │    ├─ Query SAVED_QUERIES for SQL_TEXT
       │    ├─ Query DASHBOARD_FILTERS + BINDINGS for filter metadata
       │    ├─ Call resolve_filters() (services/filter_service)
       │    ├─ Apply user-provided filter values
       │    └─ Execute final SQL
       └─ Return [{ item_id, item_type, geometry, attributes, query_result, tab_id }]
```
