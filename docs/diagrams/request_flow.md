# Request Flow Summary

> Generated: 2026-06-07 | Confidence: HIGH

## Key Request Flows

See [request_lifecycle.md](request_lifecycle.md) for detailed sequence diagrams of each flow.

---

## Flow 1: Dashboard Viewing

```
Browser → GET /api/dashboards/{id}/items?filters={...}
  → JWT validation (get_current_user)
  → RBAC check (require_any_role)
  → Query DASHBOARD_ITEMS
  → For each item:
      → Resolve SAVED_QUERIES SQL_TEXT
      → Resolve filter bindings
      → Replace {{filter:key}} with parameterized predicates
      → Execute final SQL (FETCH FIRST 1000 ROWS ONLY)
  → Return [{ item_id, item_type, query_result, geometry, attributes, tab_id }]
  → Frontend: instantiate chart class → Canvas 2D render
```

---

## Flow 2: Authentication

```
Browser → POST /api/auth/login (form-encoded username + password)
  → Query users by username
  → Verify BCrypt hash
  → Create JWT (sub=user.id, exp=now+120min)
  → Background: update LAST_LOGIN timestamp
  → Return { access_token, token_type: "bearer" }
  → Frontend: localStorage.setItem('jwt', token)
  → Frontend: set Axios Authorization header
  → Frontend: navigate to /
```

---

## Flow 3: SQL Editor

```
Browser → POST /api/editor/sql/execute { sql, limit }
  → Validate: SELECT only
  → Append FETCH FIRST N ROWS ONLY
  → Execute raw SQL
  → Return { columns, rows }
  → Frontend: display in Chakra Table
```

---

## Flow 4: Filter Application

```
User changes filter value → clicks "تایید" (Apply)
  → Browser → GET /api/dashboards/{id}/items?filters={"fAmount":500}
  → Backend: parse filters JSON
  → For each dashboard item:
      → Look up filter metadata (operator, default, allow_empty, logical_column)
      → For each {{filter:key}} placeholder:
          → Has user value? → Generate: col OP :param
          → Has default? → Use default
          → allow_empty? → Skip
          → else → AND 1=0 (no rows)
      → Execute processed SQL
  → Return updated items
  → Frontend: re-render charts with new data
```

---

## Flow 5: SQL Save with Audit

```
Browser → POST /api/editor/sql/save { name, sql }
  → Check if name already exists
  → If exists:
      → UPDATE SAVED_QUERIES SET SQL_TEXT = :sql
      → If SQL changed: background task logs old/new to SAVED_QUERIES_UPDATE_LOG
      → Return { success, updated: true }
  → If new:
      → INSERT INTO SAVED_QUERIES (saved_queries_id_seq.nextval, ...)
      → Return { success, created: true }
```

---

## Error Flow: 401 Handling

```
Any API request → Backend returns 401
  → Axios response interceptor fires
  → localStorage.removeItem('jwt')
  → delete axios.defaults.headers.common['Authorization']
  → window.location.replace('/login')
  → LoginPage mounts → checks localStorage → no JWT → shows login form
```
