# Backend Authentication & Authorization

> Generated: 2026-06-07 | Confidence: HIGH

## Authentication Flow

### Technology Stack
- **Token format:** JWT (JSON Web Token)
- **Algorithm:** HS256 (HMAC with SHA-256)
- **Secret key:** From `.env` (`SECRET_KEY=hSAFb37afSFa`)
- **Token expiry:** 120 minutes (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Password hashing:** BCrypt with 12 rounds (4096 iterations of Blowfish)

### Login Endpoint

**POST `/api/auth/login`**

```
Request:  Content-Type: application/x-www-form-urlencoded
          username=admin&password=admin

Response: 200 OK
          { "access_token": "eyJ...", "token_type": "bearer" }

Error:    401 Unauthorized
          { "detail": "Invalid credentials" }
```

**Internal flow:**
1. Parse `username` and `password` from form data
2. Query `users` table by username
3. Check `enabled == 1` (disabled users cannot login)
4. Verify password with `bcrypt.checkpw(plain.encode(), hashed.encode())`
5. Create JWT: `{ "sub": user.id, "exp": now + 120min }`
6. Background task: update `LAST_LOGIN` and `UPDATED_AT` to `SYSTIMESTAMP`

### Token Validation

**Dependency:** `get_current_user(db, token)`

Used by all protected endpoints via `Depends(get_current_user)` or indirectly through `require_any_role()`.

1. The token is extracted from the `Authorization: Bearer <token>` header by `OAuth2PasswordBearer`
2. `jwt.decode(token, secret_key, algorithms=[HS256])`
3. Extract `sub` claim (user ID)
4. Fetch user from database: `db.get(User, int(user_id))`
5. Return User object (or 401 if any step fails)

### Registration Endpoint

**POST `/api/auth/register`**

```
Request:  Content-Type: application/x-www-form-urlencoded
          username=john&email=john@example.com&password=secret&confirm_password=secret

Response: 200 OK
          { "status": "ok" }

Error:    409 Conflict (username or email already exists)
          401 Unauthorized (passwords don't match)
```

**Internal flow:**
1. Check username uniqueness (query `users` by username)
2. Check email uniqueness (query `users` by email)
3. Validate password == confirm_password
4. Hash password: `bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))`
5. Insert into USERS table with `user_id_seq.nextval` and role "ROLE_USER"

---

## Authorization (RBAC)

### Role Resolution

A user's effective roles are the **union** of:
1. **Direct roles** — Roles assigned via the `user_roles` association table
2. **Inherited roles** — Roles assigned to groups the user belongs to, via `USER_GROUPS` → `ROLE_GROUPS`

```python
def get_user_role_names(user: User, db: Session) -> Set[str]:
    role_names = set()
    # Direct roles
    if user.roles:
        role_names.update({normalize_role(r.name) for r in user.roles})
    # Group-inherited roles
    if user.groups:
        for group in user.groups:
            if group.roles:
                role_names.update({normalize_role(r.name) for r in group.roles})
    return role_names
```

**NOTE:** Role names are normalized to lowercase for comparison.

### Role-Based Access Control

The `require_any_role(*role_names)` factory creates FastAPI dependencies:

```python
@router.get("/dashboards/mine")
def list_my_dashboards(
    db: Session = Depends(get_db),
    user = Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin"))
):
    ...
```

**How it works:**
1. `get_current_user()` resolves the authenticated user
2. `get_user_role_names()` resolves all effective roles
3. If the intersection of [user's roles] ∩ [required roles] is empty → 403
4. Otherwise, returns the user

### Required Roles by Endpoint

| Endpoint | Required Roles |
|----------|---------------|
| `POST /api/dashboards/` | `dashboard_editor`, `admin` |
| `GET /api/dashboards/mine` | `dashboard_viewer`, `dashboard_editor`, `admin` |
| `GET /api/dashboards/{id}` | `dashboard_viewer`, `dashboard_editor`, `admin` |
| `GET /api/dashboards/{id}/items` | `dashboard_viewer`, `dashboard_editor`, `admin` |
| `GET /api/dashboards/{id}/tabs` | `dashboard_viewer`, `dashboard_editor`, `admin` |
| `GET /api/dashboards/{id}/filter-groups` | `dashboard_viewer`, `dashboard_editor`, `admin` |
| `POST /api/editor/sql/execute` | `dashboard_editor`, `admin` |
| `POST /api/editor/sql/save` | `dashboard_editor`, `admin` |
| `GET /api/editor/sql/saved` | `dashboard_editor`, `admin` |
| `GET /api/user/roles` | (authenticated only, no role requirement) |
| `POST /api/auth/login` | (public) |
| `POST /api/auth/register` | (public) |
| `GET /api/ping` | (public) |
| `GET /health` | (public) |

### Legacy Role Column

The `users` table has a flat `ROLE` column (VARCHAR2(255)) that is mapped on the User model but is **not used** by the RBAC system. The role "ROLE_USER" is assigned during registration. This appears to be a legacy field that predates the full RBAC implementation.

---

## Token Storage (Frontend)

- JWT stored in `localStorage` under key `"jwt"`
- Axios interceptor attaches `Authorization: Bearer <token>` to all requests
- On 401 response: token is removed, user is redirected to `/login`
- No refresh token mechanism — when the JWT expires (120 min), the user must re-login

---

## Security Observations

| Aspect | Current State | Risk Level |
|--------|-------------|------------|
| JWT algorithm | HS256 (symmetric) | **Medium** — Slightly less secure than RS256 for distributed systems |
| Secret key | Hardcoded in `.env` (`hSAFb37afSFa`) | **Medium** — Not a cryptographically random value |
| Token storage | localStorage | **Medium** — Vulnerable to XSS; httpOnly cookie would be more secure |
| Password hashing | BCrypt 12 rounds | **Good** — Industry standard |
| Token expiry | 120 minutes | **Reasonable** — Could be shorter for sensitive applications |
| CORS | Allow all origins (`*`) | **High risk in production** — Should be restricted |
| Error messages | Leak details ("User not found" vs "Invalid token") | **Low** — Distinguishes between invalid token and missing user |
| Rate limiting | None | **Medium** — Login endpoint could be brute-forced |
| Account lockout | None | **Medium** — No protection against repeated failed logins |
