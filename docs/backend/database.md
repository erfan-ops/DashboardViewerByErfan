# Database Layer

> Generated: 2026-06-07 | Confidence: HIGH

## Connection

**Driver:** `oracle+oracledb` (thin mode, no Oracle Instant Client required)

**Connection URL Construction:**
```python
# db/session.py
oracle+oracledb://{username}:{password}@{host}:{port}/?service_name={service}
```

**Default Connection (from .env):**
```
oracle+oracledb://TM:tm@192.168.1.42:1521/?service_name=pdb.oracle.ek
```

**Engine Configuration:**
```python
engine = create_engine(build_oracle_url(), pool_pre_ping=True)
```
- `pool_pre_ping=True` — Validates connections before use (prevents stale connection errors)
- Default pool size (5 connections) — Not explicitly configured

---

## Session Management

```python
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- **autocommit=False** — Transactions are explicit
- **autoflush=False** — Changes are not flushed to DB until `db.commit()` is called
- **Pattern:** FastAPI dependency injection via `Depends(get_db)`
- The session is closed in the `finally` block, even on exceptions

---

## Table Creation Strategy

**Dev mode (current):**
```python
# main.py lifespan
Base.metadata.create_all(bind=engine)
```
- Creates all ORM-mapped tables on every application startup
- Catches exceptions silently (app starts even if DB unavailable)
- Only creates tables that don't already exist (no DROP)
- **Only creates tables mapped in ORM models** — unmapped tables (DASHBOARD_ITEMS, etc.) are NOT auto-created

**Production recommendation (per code comment):**
Use Alembic migrations instead. Alembic is installed but no migration scripts exist.

---

## Query Patterns

### Pattern 1: ORM Query (Simple CRUD)
Used for straightforward queries on mapped tables:

```python
# auth.py
user = db.query(User).filter(User.username == username).first()

# auth.py
user = db.get(User, int(user_id))

# dashboards.py
d = db.get(Dashboard, dashboard_id)
d = Dashboard(name=payload.name, spec=payload.spec, owner_id=user.id)
db.add(d)
db.commit()
db.refresh(d)
```

### Pattern 2: Raw SQL via text() (Complex Queries)
Used for queries involving unmapped tables or complex JOINs:

```python
# dashboards.py
with db.bind.connect() as conn:
    stmt = text("SELECT ... FROM DASHBOARD_ITEMS WHERE ...")
    result = conn.execute(stmt, {"param": value})
    rows = result.fetchall()
```

**Why raw SQL is used:**
- `DASHBOARD_ITEMS`, `DASHBOARD_TABS`, `DASHBOARD_FILTERS`, etc. don't have ORM models
- Oracle-specific syntax (`XMLSERIALIZE`, `SYSTIMESTAMP`, `FETCH FIRST N ROWS ONLY`)
- Dynamic SQL generation with filter placeholders
- Sequence-based ID generation (`user_id_seq.nextval`)

### Pattern 3: Connection-level Operations
For operations that need transaction control outside the session:

```python
# auth.py (register)
with db.bind.connect() as conn:
    conn.execute(text("INSERT INTO USERS ..."), {...})
    conn.commit()

# editor.py (save)
with db.bind.connect() as conn:
    conn.execute(text("UPDATE SAVED_QUERIES ..."), {...})
    conn.commit()
```

This pattern bypasses the SQLAlchemy session entirely and works directly with the connection. This is used when operations need a separate transaction scope.

---

## Oracle-Specific Features Used

| Feature | Usage | Location |
|---------|-------|----------|
| `SYSTIMESTAMP` | Server-side timestamp for LAST_LOGIN, UPDATED_AT | auth.py, editor.py |
| `XMLSERIALIZE(CONTENT ... AS VARCHAR2(4000))` | Convert XML columns to strings | dashboards.py |
| `FETCH FIRST N ROWS ONLY` | Row limiting (Oracle 12c+) | dashboards.py, editor.py |
| `sequence.nextval` | ID generation | auth.py, editor.py |
| `TO_CHAR(date, 'YYYY-MM-DD"T"HH24:MI:SS')` | Date formatting | dashboards.py |

---

## Unmapped Database Tables

These tables are essential to the application but are accessed only via raw SQL:

### DASHBOARD_ITEMS
Stores the visual elements on a dashboard.
```
ID, DASHBOARD_ID, ITEM_TYPE (BAR/LIN/PIE), DISPLAY_ORDER,
GEOMETRY (XML), ATTRIBUTES (XML), SQL_ID (FK→SAVED_QUERIES),
TAB_ID (FK→DASHBOARD_TABS)
```

### DASHBOARD_TABS
Organizes items into tabs within a dashboard.
```
ID, DASHBOARD_ID, NAME_, DISPLAY_ORDER
```

### DASHBOARD_FILTERS
Defines filter parameters bound to SQL queries.
```
id, filter_key, operator_type, data_type, default_value, allow_empty
```

### DASHBOARD_FILTER_BINDINGS
Binds filters to specific SQL queries, specifying which logical column to filter.
```
filter_id, sql_id, logical_column
```

### DASHBOARD_FILTER_GROUPS
Groups filters together for UI placement.
```
id, name, position (XML), dashboard_id, tab_id
```

### DASHBOARD_FILTER_GROUP_MEMBERS
Maps filters to groups.
```
group_id, filter_id
```

### SAVED_QUERIES_UPDATE_LOG
Audit trail for SQL changes.
```
SQL_ID, OLD_SQL_TEXT, NEW_SQL_TEXT, USER_ID
```

---

## Pool & Connection Considerations

1. **No pool size configuration** — Uses SQLAlchemy defaults (5 connections)
2. **pool_pre_ping=True** — Each connection is tested before use, adding a small overhead per checkout
3. **No connection recycling** — Long-lived connections may hit Oracle idle timeout
4. **No read/write splitting** — All queries go to the same connection pool

**Production recommendations:**
- Configure `pool_size` and `max_overflow` based on expected concurrency
- Add `pool_recycle` to prevent Oracle idle timeout disconnects
- Consider connection timeout settings
