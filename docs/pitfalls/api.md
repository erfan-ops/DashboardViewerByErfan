# Pitfalls: API

> Generated: 2026-06-07 | Confidence: HIGH

## 1. No Rate Limiting

**Severity:** Medium | **Endpoints:** All, especially `/api/auth/login`

There is no rate limiting on any endpoint. The login endpoint is particularly vulnerable to brute-force attacks.

**Suggested improvement:** Add slowapi or similar rate limiting middleware.

---

## 2. SELECT Validation is Too Simple

**Severity:** Low | **File:** `api/editor.py` line 27

```python
if not sql.lower().lstrip().startswith("select"):
```

This prevents INSERT/UPDATE/DELETE but doesn't protect against:
- Subqueries that modify data within SELECT
- Oracle-specific DML within SELECT (unlikely but possible with certain functions)
- Resource exhaustion via expensive queries

**Suggested improvement:** Add query timeout, row limit enforcement, and ideally a read-only DB user for query execution.

---

## 3. Filter JSON Parsing Error Handling

**Severity:** Low | **File:** `api/dashboards.py` line 145

```python
try:
    provided_filters = json.loads(filters)
except Exception:
    raise HTTPException(status_code=400, detail="invalid filters JSON")
```

The error message is minimal — doesn't tell the user what was wrong with their JSON.

**Suggested improvement:** Include the parse error details for debugging (but sanitize).

---

## 4. Items Endpoint Performance: N+1 Queries

**Severity:** Medium | **File:** `api/dashboards.py` lines 130-323

For each dashboard item, the endpoint executes:
1. A query to get SQL_TEXT from SAVED_QUERIES
2. A query to get filter metadata from DASHBOARD_FILTERS + BINDINGS
3. The actual filtered SQL execution

For 20 items, this is ~60 round-trips to the database.

**Suggested improvement:** Batch the SQL_TEXT and filter metadata lookups with a single JOIN query.

---

## 5. No Request/Response Logging

**Severity:** Low | **All endpoints**

There is no structured logging of API requests, responses, or errors. Debugging production issues requires adding print statements.

**Suggested improvement:** Add FastAPI middleware for request/response logging with correlation IDs.

---

## 6. Token Expiry Not Signaled

**Severity:** Low | **File:** `api/auth.py`

When a token is expired, the server returns 401 "Invalid token" — the same message as for a malformed token. The client can't distinguish "token expired, please refresh" from "token invalid, please re-login".

**Suggested improvement:** Differentiate error messages: "Token expired" vs "Invalid token".

---

## 7. No API Versioning

**Severity:** Low | **All endpoints**

There's no API versioning scheme (e.g., `/api/v1/`). Changes to the API will break existing clients.

**Suggested improvement:** Add version prefix to routes: `/api/v1/`.
