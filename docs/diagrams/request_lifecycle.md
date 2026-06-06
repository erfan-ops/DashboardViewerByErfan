# Request Lifecycle

> Generated: 2026-06-07 | Confidence: HIGH

## Full Request Lifecycle: Dashboard Viewing

This documents the complete flow from a user clicking a dashboard to seeing rendered charts.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant React as React App
    participant Router as React Router
    participant VP as ViewerPage
    participant Axios as Axios
    participant Vite as Vite Proxy
    participant FastAPI as FastAPI
    participant Auth as Auth Dependency
    participant RBAC as RBAC Check
    participant DB as Oracle DB
    participant Canvas as Canvas 2D

    User->>Browser: Clicks dashboard card on HomePage
    Browser->>React: Navigate to /viewer/123
    Router->>VP: Mount ViewerPage with id=123

    par Parallel API calls
        VP->>Axios: GET /api/dashboards/123
        Axios->>Vite: Proxy request
        Vite->>FastAPI: GET /api/dashboards/123
        FastAPI->>Auth: get_current_user(token)
        Auth->>Auth: jwt.decode(token)
        Auth->>DB: SELECT FROM users WHERE ID = :sub
        Auth-->>FastAPI: User object
        FastAPI->>RBAC: require_any_role("dashboard_viewer",...)
        RBAC-->>FastAPI: Authorized
        FastAPI->>DB: SELECT FROM dashboards WHERE id = 123
        DB-->>FastAPI: Dashboard row
        FastAPI-->>Vite-->>Axios-->>VP: { id, name, description }
    and
        VP->>Axios: GET /api/dashboards/123/tabs
        Note over VP,Axios: Same auth/RBAC flow
        DB-->>VP: [{ tab_id, tab_name, display_order }]
    and
        VP->>Axios: GET /api/dashboards/123/items
        Note over VP,Axios: Same auth/RBAC flow
        loop For each dashboard item
            FastAPI->>DB: SELECT SQL_TEXT FROM SAVED_QUERIES
            FastAPI->>DB: SELECT filter metadata + bindings
            FastAPI->>FastAPI: Replace {{filter:key}} placeholders
            FastAPI->>DB: Execute parameterized SQL
        end
        DB-->>VP: [{ item_id, item_type, query_result, geometry, attributes }]
    and
        VP->>Axios: GET /api/dashboards/123/filter-groups
        Note over VP,Axios: Same auth/RBAC flow
        DB-->>VP: [{ group_id, name, position, filters: [...] }]
    end

    VP->>VP: Set state: items, tabs, filterGroups, dashboardName
    VP->>VP: Select first tab (sorted by display_order)
    VP->>VP: Filter items by selectedTab

    loop For each visible item
        VP->>VP: parseGeometry(item.geometry) → {x,y,w,h}
        VP->>VP: parseAttributes(item.attributes) → ChartConfig
        VP->>VP: toRowObjects(query_result) → data[]
        VP->>Canvas: new BarChartItem / LineChartItem / PieChartItem
        Canvas->>Canvas: chart.render(null)
        Note over Canvas: clearRect, draw background,<br/>grid lines, data bars/lines/arcs,<br/>labels with Persian digits
    end

    Canvas-->>User: Dashboard rendered
```

---

## Authentication Request Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant LoginPage
    participant Axios
    participant FastAPI
    participant DB
    participant localStorage

    User->>LoginPage: Enters username + password
    LoginPage->>LoginPage: Build URLSearchParams (form encoded)
    LoginPage->>Axios: POST /api/auth/login<br/>Content-Type: application/x-www-form-urlencoded<br/>Body: username=...&password=...
    Axios->>FastAPI: Forward request

    FastAPI->>FastAPI: Parse Form(username, password)
    FastAPI->>DB: SELECT FROM users WHERE USERNAME = :username
    DB-->>FastAPI: User row (or null)

    alt User not found
        FastAPI-->>LoginPage: 401 "Invalid credentials"
        LoginPage->>LoginPage: Show error toast
    else User found, enabled=0
        FastAPI-->>LoginPage: 401 "Invalid credentials"
    else User found, enabled=1
        FastAPI->>FastAPI: verify_password(plain, password_hash)
        alt Password match
            FastAPI->>FastAPI: create_access_token(subject=user.id, expires=120min)
            FastAPI-->>LoginPage: 200 { access_token, token_type: "bearer" }
            LoginPage->>localStorage: setItem('jwt', token)
            LoginPage->>Axios: Set default header: Authorization: Bearer <token>
            LoginPage->>LoginPage: navigate('/')
            FastAPI->>DB: Background: UPDATE LAST_LOGIN, UPDATED_AT
        else Password mismatch
            FastAPI-->>LoginPage: 401 "Invalid credentials"
        end
    end
```

---

## Filter Application Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant ViewerPage
    participant Axios
    participant FastAPI
    participant DB

    User->>ViewerPage: Changes filter value + clicks "تایید" (Apply)
    ViewerPage->>ViewerPage: Build filter payload:<br/>{ filter_key: value, ... }
    ViewerPage->>Axios: GET /api/dashboards/{id}/items?filters={"fAmount":500}
    Axios->>FastAPI: Forward request with auth

    FastAPI->>FastAPI: Parse filters JSON from query string
    FastAPI->>DB: SELECT dashboard items
    DB-->>FastAPI: Items list

    loop For each item
        FastAPI->>DB: SELECT SQL_TEXT FROM SAVED_QUERIES
        FastAPI->>DB: SELECT filter metadata + logical_column bindings
        FastAPI->>FastAPI: For each {{filter:key}} placeholder:
        alt User provided value
            FastAPI->>FastAPI: Generate predicate based on operator<br/>(=, >, <, IN, BETWEEN, LIKE)
        else No value, has default
            FastAPI->>FastAPI: Use default value
        else No value, allow_empty
            FastAPI->>FastAPI: Skip filter (return empty string)
        else No value, not allow_empty
            FastAPI->>FastAPI: Return "AND 1=0" (no rows)
        end
        FastAPI->>DB: Execute processed SQL with params
    end

    FastAPI-->>ViewerPage: Updated items with filtered data
    ViewerPage->>ViewerPage: Re-render charts with new data
```

---

## SQL Save/Update Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant EditorPage
    participant Axios
    participant FastAPI
    participant DB
    participant Background

    User->>EditorPage: Types SQL, enters name, clicks "Save"
    EditorPage->>Axios: POST /api/editor/sql/save<br/>{ name, sql }
    Axios->>FastAPI: Forward with auth + role check

    FastAPI->>FastAPI: Validate: only SELECT statements allowed
    FastAPI->>DB: SELECT ID, SQL_TEXT FROM SAVED_QUERIES<br/>WHERE NAME = :name

    alt Name already exists
        DB-->>FastAPI: Existing row (id, old_sql)
        FastAPI->>DB: UPDATE SAVED_QUERIES SET SQL_TEXT = :sql<br/>WHERE ID = :id
        FastAPI-->>EditorPage: { success: true, updated: true }

        alt SQL text changed
            FastAPI->>Background: Schedule background task
            Background->>DB: UPDATE SAVED_QUERIES SET UPDATED_AT = SYSTIMESTAMP
            Background->>DB: INSERT INTO SAVED_QUERIES_UPDATE_LOG<br/>(SQL_ID, OLD_SQL_TEXT, NEW_SQL_TEXT, USER_ID)
        end
    else New name
        DB-->>FastAPI: No existing row
        FastAPI->>DB: INSERT INTO SAVED_QUERIES<br/>ID = saved_queries_id_seq.nextval, OWNER_ID, NAME, SQL_TEXT
        FastAPI-->>EditorPage: { success: true, created: true }
    end
```

---

## Error Handling Flow

```mermaid
flowchart TD
    A[API Request] --> B{Token valid?}
    B -->|No| C[401: Invalid token]
    B -->|Yes| D{RBAC check passes?}
    D -->|No| E[403: Insufficient role]
    D -->|Yes| F[Execute endpoint logic]
    F --> G{Exception?}
    G -->|HTTPException| H[Return status + detail]
    G -->|Other Exception| I[500: str(e)]
    G -->|Success| J[Return 200/201 + response model]

    C --> K[Frontend: Axios 401 interceptor]
    K --> L[Clear localStorage jwt]
    L --> M[Delete Authorization header]
    M --> N{Navigating to /login?}
    N -->|No| O[window.location.replace('/login')]
    N -->|Yes| P[Stay on /login]
```

The frontend's global Axios 401 interceptor (`main.tsx:78-93`) catches all 401 responses and:
1. Removes the JWT from localStorage
2. Clears the Authorization header
3. Redirects to `/login` (unless already on the login page — prevents redirect loops)
