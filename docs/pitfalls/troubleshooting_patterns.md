# Pitfalls: Troubleshooting Patterns

> Generated: 2026-06-07 | Confidence: HIGH

## Common Issues & Diagnostic Steps

### "Invalid credentials" on Valid Login

**Possible causes:**
1. User does not exist in `users` table
2. `ENABLED` column is 0 (disabled account)
3. Password hash is wrong or from a different BCrypt implementation
4. Oracle connection is down (verify DB connectivity first)

**Diagnostic steps:**
```bash
# Test DB connectivity
curl http://127.0.0.1:8000/api/ping

# Try login (check response)
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=TM&password=tm"
```

---

### Dashboard Shows "No dashboard items found"

**Possible causes:**
1. No `DASHBOARD_ITEMS` rows for this dashboard_id
2. `SAVED_QUERIES` references broken (SQL_ID doesn't exist)
3. All SQL queries failed (non-SELECT, or Oracle errors)
4. `USER_DASHBOARD_PRIVS` doesn't grant access

**Diagnostic:**
- Check browser Network tab for the items API response
- Check for empty `query_result` arrays
- Verify SQL_TEXT in SAVED_QUERIES starts with SELECT

---

### 401 Error on Every Request

**Possible causes:**
1. JWT expired (120 min default)
2. JWT was cleared from localStorage
3. Backend SECRET_KEY changed (tokens signed with old key are invalid)
4. User was deleted from the database

**Mitigation:** Check browser DevTools → Application → Local Storage → `jwt` key.

---

### Charts Not Rendering (Blank Canvas)

**Possible causes:**
1. Canvas 2D context not available (unlikely in modern browsers)
2. `geometry` XML missing or null (falls back to 800×600 default)
3. `attributes` XML missing required fields
4. `query_result` has 0 rows or columns
5. The `messure` typo bug in pie attribute parsing (see `pitfalls/frontend.md`)

**Diagnostic:** Check items API response for `geometry`, `attributes`, and `query_result` fields.

---

### Database Connection Error on Startup

**Symptom:** `[startup] Skipping DB init (reason: ...)` in console

**Possible causes:**
1. Oracle DB not accessible from the application host
2. Wrong credentials in `.env`
3. Oracle listener not running on 192.168.1.42:1521
4. VPN/tunnel required to reach the database network

**Fix:** Verify connectivity with SQL*Plus:
```bash
sqlplus TM/tm@192.168.1.42:1521/pdb.oracle.ek
```

---

### Frontend Not Connecting to Backend

**Symptom:** API calls return 404 or CORS errors

**Possible causes:**
1. Backend not running on port 8000
2. Vite proxy not configured correctly
3. Running frontend without Vite (`npm run build` serves static files without proxy)

**Fix:** Ensure both servers are running:
```bash
# Terminal 1: Backend
cd backend && uv run python -m app.main

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

### "Table or view does not exist" Oracle Error

**Possible causes:**
1. Tables not created — `Base.metadata.create_all()` only creates ORM-mapped tables
2. `DASHBOARD_ITEMS`, `DASHBOARD_TABS`, etc. are NOT auto-created (no ORM models)
3. Oracle user doesn't have CREATE TABLE privilege

**Fix:** These unmapped tables must be created manually or via a separate DDL script.

---

### Filter Not Working (No Data Returned)

**Symptom:** Charts show "No data" after applying a filter

**Trace the filter resolution:**
1. User provides filter value → sent in query string as JSON
2. Backend looks up `DASHBOARD_FILTERS` for `filter_key`
3. Backend checks `DASHBOARD_FILTER_BINDINGS` for `logical_column`
4. If no value, checks `default_value`
5. If no default and `allow_empty=0` → returns `AND 1=0` (no rows)

**Common fix:** Set `allow_empty=1` on filters that should be optional, or provide `default_value`.
