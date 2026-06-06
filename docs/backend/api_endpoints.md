# API Endpoints Reference

> Generated: 2026-06-07 | Confidence: HIGH

## Base URL

- Development: `http://127.0.0.1:8000`
- All API routes prefixed with `/api`

## Authentication

Most endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Endpoint Index

### Public Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/api/ping` | None | DB connectivity test |
| POST | `/api/auth/login` | None | User login |
| POST | `/api/auth/register` | None | User registration |

### Protected Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/user/roles` | Any authenticated | Get current user's roles |
| GET | `/api/dashboards/mine` | viewer, editor, admin | List user's dashboards |
| POST | `/api/dashboards/` | editor, admin | Create dashboard |
| GET | `/api/dashboards/{id}` | viewer, editor, admin | Get dashboard details |
| GET | `/api/dashboards/{id}/items` | viewer, editor, admin | Get dashboard items with optional filters |
| GET | `/api/dashboards/{id}/tabs` | viewer, editor, admin | Get dashboard tabs |
| GET | `/api/dashboards/{id}/filter-groups` | viewer, editor, admin | Get filter groups |
| POST | `/api/editor/sql/execute` | editor, admin | Execute SQL query |
| POST | `/api/editor/sql/save` | editor, admin | Save/update SQL query |
| GET | `/api/editor/sql/saved` | editor, admin | List saved queries |

---

## Detailed Endpoint Specifications

### GET /health

**Purpose:** Lightweight health check. No DB dependency.

**Response 200:**
```json
{ "status": "ok" }
```

---

### GET /api/ping

**Purpose:** Lazy DB connectivity validation. Uses `get_db` dependency.

**Response 200:**
```json
{ "message": "pong" }
```

**Error:** Returns DB connection error if unavailable.

---

### POST /api/auth/login

**Purpose:** Authenticate user and return JWT.

**Request:**
- Content-Type: `application/x-www-form-urlencoded`
- Body: `username=<string>&password=<string>`

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Error 401:**
```json
{ "detail": "Invalid credentials" }
```

**Side effects:** Background task updates `LAST_LOGIN` and `UPDATED_AT` timestamps.

---

### POST /api/auth/register

**Purpose:** Register a new user account.

**Request:**
- Content-Type: `application/x-www-form-urlencoded`
- Body: `username=<string>&email=<email>&password=<string>&confirm_password=<string>`

**Response 200:**
```json
{ "status": "ok" }
```

**Errors:**
- 409: `"User \"{username}\" already exists."`
- 409: `"Email \"{email}\" is already registered."`
- 401: `"Passwords did not match!!!"`

---

### GET /api/user/roles

**Purpose:** Get the current user's effective role names (direct + group-inherited).

**Response 200:**
```json
["dashboard_viewer", "dashboard_editor"]
```

---

### GET /api/dashboards/mine

**Purpose:** List dashboards accessible to the authenticated user.

**Response 200:**
```json
[
  {
    "id": 1,
    "name": "Sales Dashboard",
    "description": "Monthly sales metrics",
    "last_opened": "2026-06-07T14:30:00"
  }
]
```

**Implementation note:** Uses raw SQL JOIN between `dashboards` and `user_dashboard_privs` to get dashboards + `last_opened` timestamps.

---

### POST /api/dashboards/

**Purpose:** Create a new dashboard.

**Request:**
```json
{
  "name": "Sales Dashboard",
  "spec": { "layout": "..." }
}
```

**Response 201:**
```json
{
  "id": 1,
  "name": "Sales Dashboard",
  "description": ""
}
```

**⚠️ Potential bug:** The endpoint passes `spec` and `owner_id` to the Dashboard constructor, but these are NOT mapped columns on the Dashboard ORM model. This may cause errors at runtime.

---

### GET /api/dashboards/{dashboard_id}

**Purpose:** Get dashboard metadata by ID.

**Response 200:**
```json
{
  "id": 1,
  "name": "Sales Dashboard",
  "description": "Monthly sales metrics"
}
```

**Error 404:** `"Dashboard not found"`

---

### GET /api/dashboards/{dashboard_id}/items

**Purpose:** Get dashboard items with executed SQL query results. This is the primary data endpoint for dashboard rendering.

**Query Parameters:**
- `filters` (optional): JSON string of filter values, e.g. `{"fAmount": 500, "fRegion": ["North", "South"]}`

**Response 200:**
```json
[
  {
    "item_id": 10,
    "item_type": "BAR",
    "display_order": 1,
    "geometry": "<item x=\"0\" y=\"0\" w=\"800\" h=\"400\"/>",
    "attributes": "<barChart type=\"vertical\">...</barChart>",
    "query_result": {
      "columns": ["REGION", "AMOUNT"],
      "rows": [["North", 5000], ["South", 3000]]
    },
    "tab_id": 1
  }
]
```

**Filter processing:**
1. `{{filter:key}}` placeholders in SQL are replaced with parameterized predicates
2. User-provided filter values take precedence over defaults
3. Operators supported: =, >, <, >=, <=, <>, IN, BETWEEN, LIKE
4. Results limited to 1000 rows per item

**Items skipped when:**
- SQL text is not found for the SQL_ID
- SQL does not start with SELECT

---

### GET /api/dashboards/{dashboard_id}/tabs

**Purpose:** Get tab definitions for a dashboard.

**Response 200:**
```json
[
  {
    "tab_id": 1,
    "tab_name": "Overview",
    "display_order": 1
  },
  {
    "tab_id": 2,
    "tab_name": "Details",
    "display_order": 2
  }
]
```

---

### GET /api/dashboards/{dashboard_id}/filter-groups

**Purpose:** Get filter group definitions with their member filters and position.

**Response 200:**
```json
[
  {
    "group_id": 1,
    "name": "Date Filters",
    "position": "<item x=\"20\" y=\"80\"/>",
    "tab_id": 1,
    "filters": [
      {
        "filter_id": 5,
        "name": "Amount",
        "filter_key": "fAmount",
        "operator_type": ">",
        "data_type": "NUMBER",
        "default_value": "100",
        "allow_empty": true
      }
    ]
  }
]
```

**⚠️ Bug note:** The response_model annotation is `DashboardFilterGroupResult` (singular) but the endpoint returns a list. The annotation should be `List[DashboardFilterGroupResult]`.

---

### POST /api/editor/sql/execute

**Purpose:** Execute an arbitrary SELECT query against the Oracle database.

**Request:**
```json
{
  "sql": "SELECT * FROM employees WHERE department_id = 10",
  "limit": 200
}
```

**Response 200:**
```json
{
  "columns": ["EMPLOYEE_ID", "FIRST_NAME", "LAST_NAME"],
  "rows": [[1, "John", "Doe"], [2, "Jane", "Smith"]]
}
```

**Error 400:** `"Only SELECT statements are allowed"`

**Security:** Only SELECT statements are permitted. The statement is checked with `sql.lower().startswith("select")`. No further SQL injection protection — users with access can execute any SELECT query their Oracle user has privileges for.

---

### POST /api/editor/sql/save

**Purpose:** Save or update a named SQL query.

**Request:**
```json
{
  "name": "Employee Query",
  "sql": "SELECT * FROM employees"
}
```

**Response 200 (updated):**
```json
{ "success": true, "updated": true }
```

**Response 200 (created):**
```json
{ "success": true, "created": true }
```

**Error 400:** `"Only SELECT statements are allowed"`

**Side effects (on update):** Background task logs the change to `SAVED_QUERIES_UPDATE_LOG` if SQL text changed.

---

### GET /api/editor/sql/saved

**Purpose:** List all saved SQL queries.

**Response 200:**
```json
{
  "queries": [
    {
      "name": "Employee Query",
      "sql_text": "SELECT * FROM employees"
    }
  ]
}
```

**Note:** Results are ordered by `CREATED_AT DESC`. No pagination.

---

## Error Response Patterns

| Status | Pattern | Example |
|--------|---------|---------|
| 400 | Client error | `"Only SELECT statements are allowed"` |
| 401 | Auth failure | `"Invalid credentials"` or `"Invalid token"` |
| 403 | Authorization failure | `"Insufficient role. Required one of: admin. User has: dashboard_viewer"` |
| 404 | Resource not found | `"Dashboard not found"` |
| 409 | Conflict | `"User \"john\" already exists."` |
| 500 | Server error | `{"detail": "<exception message>"}` |

---

## OpenAPI Documentation

FastAPI auto-generates OpenAPI docs at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

The app is configured with:
```python
openapi_tags=[{"name": "auth", "description": "Login operations"}]
```

Additional tags are set on routers: `["auth"]`, `["dashboards"]`, `["editor"]`, `["user"]`.
