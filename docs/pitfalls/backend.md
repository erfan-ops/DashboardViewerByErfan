# Pitfalls: Backend

> Generated: 2026-06-07 | Confidence: HIGH

## 1. SQL Injection via Filter Values

**Severity:** Medium | **File:** `api/dashboards.py`

**The issue:** While filter values are parameterized (using `:param` bind variables), the `logical_column` value from `DASHBOARD_FILTER_BINDINGS` is inserted directly into the SQL string:

```python
return f" AND {col} {op} :{p_name} "
```

If `logical_column` contains malicious SQL, it would enable injection. The data comes from the database (not user input), so the risk is limited to compromised filter metadata.

**Suggested improvement:** Validate `logical_column` against a pattern (e.g., alphanumeric + underscore only).

---

## 2. Raw Exception Messages in 500 Responses

**Severity:** Medium | **Files:** All API endpoints

```python
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

**Why it's risky:** Oracle error messages may reveal table names, column names, and query structure to API consumers.

**Suggested improvement:** Log the full exception server-side; return a generic "Internal server error" message to clients.

---

## 3. No Duplicate Check on `saved_queries.name`

**Severity:** Low | **File:** `api/editor.py`

The `save_sql` endpoint checks if a name exists before deciding to INSERT or UPDATE. However, this check is not atomic — two concurrent requests with the same name could both attempt INSERT.

**Suggested improvement:** Use a database UNIQUE constraint on `(OWNER_ID, NAME)` and handle the duplicate key exception.

---

## 4. Password in URL

**Severity:** Low | **File:** `db/session.py` line 10

```python
return f"oracle+oracledb://{s.oracle_username}:{s.oracle_password}@{s.oracle_host}:..."
```

**Why it's risky:** If logging is enabled at DEBUG level, the database password may appear in log output.

**Suggested improvement:** Use `create_engine` with separate parameters or use SQLAlchemy's `engine.URL.create()`.

---

## 5. Race Condition on Login Timestamp Updates

**Severity:** Low | **File:** `api/auth.py` lines 89-102

The background task `background_work` opens a new DB connection to update `LAST_LOGIN` and `UPDATED_AT`. If the login response is faster than the background task, the client may make subsequent requests before the timestamp is updated.

**Why it exists:** Separating timestamp updates from the auth response for faster login.

**Suggested improvement:** Use `background_tasks` correctly (it runs after response is sent — this is actually the intended behavior). Document the eventual consistency.

---

## 6. No Pagination on Queries

**Severity:** Low | **Files:** `api/editor.py`, `api/dashboards.py`

Large datasets are truncated with `FETCH FIRST 1000 ROWS ONLY` with no way for clients to request additional pages.

**Suggested improvement:** Add OFFSET/FETCH pagination parameters to relevant endpoints.

---

## 7. `speck` Typo in Dashboard Model

**Severity:** INFO | **File:** `db/models.py` line 99

Line 99 has a comment referencing a `spec` field:
```python
# JSON schema to store layout, widgets, and references to SavedQuery
```
But there is no `spec` column on the model.

---

## 8. ORM Relationship Eager Loading

**Severity:** Low | **File:** `db/models.py`

```python
roles = relationship("Role", ..., lazy="joined")
groups = relationship("Group", ..., lazy="joined")
```

All relationships use `lazy="joined"`, meaning every query for a User always fetches roles and groups. This is convenient but adds JOIN overhead to every query, even when roles/groups aren't needed.

**Suggested improvement:** Use `lazy="selectin"` for better performance with collections, or default to `lazy="select"` and use `joinedload()` explicitly when needed.
