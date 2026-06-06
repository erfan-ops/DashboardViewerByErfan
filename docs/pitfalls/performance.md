# Pitfalls: Performance

> Generated: 2026-06-07 | Confidence: HIGH

## 1. N+1 Query Problem in Dashboard Items

**Severity:** High | **File:** `api/dashboards.py` lines 130-323

For a dashboard with N items, the endpoint makes approximately 2N+1 queries:
- 1 query: GET dashboard items
- N queries: GET SQL_TEXT for each item
- N queries: GET filter metadata for each item

**Impact:** For a dashboard with 20 items, ~41 sequential DB round-trips. Each round-trip adds ~10-50ms latency.

**Fix:** Batch queries with JOIN:
```sql
SELECT di.*, sq.SQL_TEXT
FROM DASHBOARD_ITEMS di
JOIN SAVED_QUERIES sq ON di.SQL_ID = sq.ID
WHERE di.DASHBOARD_ID = :id
```

---

## 2. Connection Pool Defaults

**Severity:** Medium | **File:** `db/session.py`

The SQLAlchemy engine uses default pool settings:
- Pool size: 5 connections
- Max overflow: 10 connections
- No connection recycling

Under load, connections may be exhausted quickly. Oracle may also terminate idle connections.

**Fix:** Configure pool size based on expected concurrency, add `pool_recycle` (e.g., 3600 seconds).

---

## 3. All Relationships are Eager-Loaded

**Severity:** Medium | **File:** `db/models.py`

```python
roles = relationship(..., lazy="joined")
groups = relationship(..., lazy="joined")
```

Every User query fetches all roles and groups via JOIN. When only the user's ID is needed (e.g., token validation), this adds unnecessary JOIN overhead.

**Fix:** Use `lazy="select"` as default and `joinedload()` explicitly where needed.

---

## 4. No Response Caching

**Severity:** Medium | **System-wide**

Dashboard data is fetched fresh from the database on every page view. For dashboards that don't change frequently, this is wasteful.

**Fix:** Add ETag or Last-Modified headers. Consider Redis caching for dashboard items (invalidate on SQL save).

---

## 5. Canvas 2D Rendering on Main Thread

**Severity:** Medium | **Files:** All chart classes

Chart rendering (especially `PieChartItem` with multiple pies) can be CPU-intensive and runs on the browser's main thread. For dashboards with many charts, this can cause UI jank.

**Fix:** Consider OffscreenCanvas or Web Workers for rendering.

---

## 6. No Frontend Bundle Splitting

**Severity:** Low | **File:** `vite.config.ts`

No code splitting configuration. The Monaco editor (~2MB) and echarts (~1MB, unused) are bundled into the main chunk.

**Fix:** Configure `manualChunks` in Vite to separate vendor libraries.

---

## 7. FETCH FIRST 1000 ROWS — Silent Truncation

**Severity:** Low | **File:** `api/dashboards.py` line 301

```python
limit_clause = " FETCH FIRST 1000 ROWS ONLY"
```

If a query returns more than 1000 rows, data is silently truncated with no indication to the user.

**Fix:** Return a warning or metadata indicating truncation occurred.
