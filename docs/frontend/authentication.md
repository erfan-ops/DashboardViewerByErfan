# Frontend Authentication

> Generated: 2026-06-07 | Confidence: HIGH

## Authentication Flow (Frontend Perspective)

### Login

```
User enters credentials → POST /api/auth/login (form-encoded)
  → Backend validates + returns JWT
  → Frontend stores JWT in localStorage['jwt']
  → Frontend sets axios.defaults.headers.common['Authorization']
  → Navigate to /
```

### Subsequent Requests

```
Page mounts → Check localStorage['jwt']
  → If exists: set Authorization header → fetch data
  → If missing: navigate to /login
```

### Token Expiry

```
API request → Backend returns 401
  → Global axios interceptor catches it
  → Remove JWT from localStorage
  → Clear Authorization header
  → Hard redirect to /login
```

### Logout

There is **no explicit logout endpoint or flow**. The user is effectively "logged out" when:
1. The JWT expires (120 minutes) and a 401 is received
2. The JWT is manually removed from localStorage
3. The browser localStorage is cleared

No "Logout" button exists in the UI. The ViewerPage has an "Exit" (خروج) button that navigates to `/` but does NOT clear the token.

---

## Token Storage

| Aspect | Implementation |
|--------|---------------|
| Location | `localStorage['jwt']` |
| Key name | `"jwt"` |
| Format | Raw JWT string |
| Expiry check | None (relies on server 401) |
| Cross-tab sync | None |

---

## Route Protection

**Component:** `ProtectedRoute.tsx`

```typescript
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('jwt')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
```

**Wrapped routes:**
- `/editor` → EditorPage
- `/viewer/:id` → ViewerPage

**Not wrapped (public):**
- `/` → HomePage
- `/login` → LoginPage
- `/register` → RegisterPage

**HomePage behavior:** Although not wrapped in ProtectedRoute, HomePage checks for JWT in useEffect and navigates to `/login` if missing.

---

## Role-Based UI

The HomePage conditionally renders UI elements based on user roles:

```typescript
const hasEditorAccess =
  userRoles.includes('admin') || userRoles.includes('dashboard_editor')
```

**Editor button:** Shown only if `hasEditorAccess` is true (in header and empty state).

Roles are fetched from `GET /api/user/roles` which returns effective role names (direct + group-inherited).

---

## Auth State Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    App Startup                           │
│  localStorage['jwt'] exists?                            │
│    ├── Yes → Set Axios header → Render current route    │
│    └── No  → Render public route or redirect            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    User logs in                          │
│  POST /api/auth/login → JWT returned                    │
│  → localStorage.setItem('jwt', token)                   │
│  → axios.defaults.headers.common['Authorization'] set   │
│  → navigate('/')                                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              API call returns 401                        │
│  → localStorage.removeItem('jwt')                       │
│  → delete axios.defaults.headers.common['Authorization']│
│  → window.location.replace('/login')                    │
└─────────────────────────────────────────────────────────┘
```

---

## Register Flow

```
User fills form → POST /api/auth/register (form-encoded)
  → Backend creates user
  → Frontend navigates to /login
```

The RegisterPage clears any existing JWT on mount (in a useEffect without dependency array — runs on every render).

---

## Comparison: Frontend vs Backend Auth

| Aspect | Frontend | Backend |
|--------|----------|---------|
| Token type | JWT | JWT (HS256) |
| Token storage | localStorage | (stateless) |
| Token validation | None (just existence check) | `jwt.decode()` + DB user lookup |
| Expiry handling | 401 interceptor | 401 response |
| Password hashing | (never sees plaintext after login) | BCrypt 12 rounds |
| Role check | Client-side (for UI display) | Server-side (for access control) |
| Logout | Clear localStorage (implicit) | No token blacklist |

---

## Security Considerations

| Concern | Severity | Detail |
|---------|----------|--------|
| **XSS vulnerability** | **Medium** | JWT in localStorage can be stolen by XSS. httpOnly cookie would mitigate this. |
| **No CSRF protection** | **Low** | Since auth is via Authorization header (not cookie), CSRF is not a concern. |
| **No logout** | **Low** | No server-side token invalidation. Compromised tokens are valid until expiry. |
| **Client-side role check** | **Info** | Role-based UI hiding is cosmetic — actual enforcement is server-side. |
| **Hardcoded dev credentials** | **Low** | `useState('admin')` for username/password in LoginPage. Removed in production builds? |
