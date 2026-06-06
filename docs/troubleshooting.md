# Troubleshooting Guide

> Generated: 2026-06-07 | Confidence: HIGH

## Quick Diagnostic Checklist

1. ✅ Backend running? `curl http://127.0.0.1:8000/health`
2. ✅ DB connected? `curl http://127.0.0.1:8000/api/ping`
3. ✅ Frontend running? Open `http://localhost:5173`
4. ✅ JWT valid? Check localStorage in DevTools
5. ✅ Roles correct? Check response from `/api/user/roles`

---

## Common Issues

### Backend Won't Start

**Symptom:** `uv run python -m app.main` fails

**Check:**
1. Python version ≥ 3.10: `python --version`
2. All dependencies installed: `uv sync`
3. `.env` file exists in `backend/` directory
4. Oracle DB is reachable

**If database is unreachable:** The app should still start (startup catches DB errors). Check the console for `[startup] Skipping DB init` message.

---

### "No dashboard items found"

**Cause:** The backend API returned 0 items.

**Check:**
1. Browser DevTools → Network → `/api/dashboards/{id}/items` response
2. Are there rows in `DASHBOARD_ITEMS` for this dashboard?
3. Do the `SAVED_QUERIES` references exist?
4. Is the SQL valid Oracle SELECT syntax?

**Quick check:**
```sql
SELECT COUNT(*) FROM DASHBOARD_ITEMS WHERE DASHBOARD_ID = <id>;
```

---

### Charts are Blank

**Cause:** Canvas rendering failed silently.

**Check:**
1. Console for JavaScript errors
2. Network tab: items endpoint returned data with `query_result`?
3. `geometry` XML parses correctly? (Check for null `w`/`h` values)
4. `attributes` XML has required fields?

**Common fix:** Ensure XML attributes use correct tag names:
- Bar: `<barChart>` with `<axes><xAxis><field name="..."/>`
- Line: `<lineChart>` with `<axes><xAxis><field name="..."/>`
- Pie: `<pie>` with `slice`, `measure` (not `messure`), `pies` attributes

---

### Login Fails with "Invalid credentials"

**Check, in order:**
1. Is the backend running? `curl http://127.0.0.1:8000/health`
2. User exists in `users` table?
3. `ENABLED` column is 1?
4. Password hash is correct BCrypt (12 rounds)?

**Debug:**
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your_username&password=your_password"
```

---

### 401 Error After Login

**Cause:** JWT token is invalid, expired, or not being sent.

**Check:**
1. DevTools → Application → Local Storage → `jwt` exists?
2. DevTools → Network → Request Headers → `Authorization: Bearer <token>` present?
3. Token expired? (Default: 120 minutes)

**Quick fix:** Clear localStorage and re-login.

---

### CORS Errors in Browser Console

**Symptom:** `Access-Control-Allow-Origin` errors

**Cause:** Frontend and backend origins don't match.

**Fix:**
- In development: ensure Vite proxy is configured (`vite.config.ts`)
- In production: configure nginx to proxy `/api` and `/auth` to backend

---

### Oracle "Table or view does not exist"

**Cause:** Required tables weren't created.

**Which tables?**
- Auto-created (ORM models): `users`, `roles`, `groups`, `dashboards`, `saved_queries`, `user_roles`, `USER_GROUPS`, `ROLE_GROUPS`, `USER_DASHBOARD_PRIVS`
- **NOT auto-created** (must be manually created): `DASHBOARD_ITEMS`, `DASHBOARD_TABS`, `DASHBOARD_FILTERS`, `DASHBOARD_FILTER_BINDINGS`, `DASHBOARD_FILTER_GROUPS`, `DASHBOARD_FILTER_GROUP_MEMBERS`, `SAVED_QUERIES_UPDATE_LOG`

**Fix:** Create the required tables via SQL*Plus or another Oracle client.

---

### Filter Returns No Data

**Trace the filter resolution:**
1. What `filter_key` was sent? Check Network tab for the `filters` query parameter.
2. Does this key exist in `DASHBOARD_FILTERS`?
3. Is it bound to the correct `SQL_ID` in `DASHBOARD_FILTER_BINDINGS`?
4. Does `allow_empty` allow the filter to be skipped?
5. Is there a `default_value`?

**If `allow_empty` is 0 and no value is provided:** The backend returns `AND 1=0` (always false), producing no rows.

---

### Frontend "Create Dashboard" Goes to 404

**Cause:** The `/create` route is not implemented.

The HomePage's "داشبورد جدید" (New Dashboard) button navigates to `/create`, but no route is registered for this path.

**Workaround:** Dashboards must be created via backend API or database directly.

---

### Performance Issues (Slow Dashboard Loading)

**Check:**
1. How many dashboard items? Each item causes 2+ DB queries.
2. Is Oracle DB on the same network? Latency adds up.
3. Check Network tab for waterfall — which API call is slow?

**Mitigations:**
- Reduce number of dashboard items per tab
- Ensure database indexes exist on foreign keys
- Consider caching (currently not implemented)
