# Pitfalls: Authentication

> Generated: 2026-06-07 | Confidence: HIGH

## 1. JWT in localStorage (XSS Vulnerability)

**Severity:** High | **Files:** `LoginPage.tsx`, `main.tsx`, `ProtectedRoute.tsx`

JWTs are stored in `localStorage`, which is accessible to any JavaScript running on the page. If an XSS vulnerability exists anywhere in the app, an attacker can steal the JWT.

**Suggested improvement:** Store JWT in an httpOnly, secure, SameSite cookie. This prevents JavaScript access while still allowing the cookie to be sent with API requests.

---

## 2. No Token Refresh Mechanism

**Severity:** Medium | **File:** `api/auth.py`

There is no refresh token flow. When the access token expires (120 min), the user must re-enter credentials.

**Suggested improvement:** Implement refresh tokens with longer expiry.

---

## 3. No Session Invalidation

**Severity:** Low | **System-wide**

There is no way to invalidate a JWT before it expires. If a user's permissions change or their account is disabled, they retain access until the token expires.

**Suggested improvement:** Maintain a token blacklist or check user status on every request (the latter is already partially done — `enabled` is checked on login but not on subsequent requests except via `get_current_user`).

---

## 4. Symmetric JWT Algorithm

**Severity:** Low | **File:** `core/config.py` line 12

```python
algorithm: str = "HS256"
```

HS256 uses the same secret for signing and verification. For distributed systems with multiple services, RS256 (asymmetric) would allow services to verify tokens without sharing the secret.

**Current assessment:** Acceptable for a single-service application. Only becomes a concern if the backend is split into microservices.

---

## 5. Weak-Looking Secret Key

**Severity:** Medium | **File:** `backend/.env`

```
SECRET_KEY=hSAFb37afSFa
```

This key is short (12 characters) and appears to be manually created rather than cryptographically generated.

**Suggested improvement:** Generate a proper secret: `openssl rand -hex 32`

---

## 6. No Password Complexity Requirements

**Severity:** Low | **File:** `api/auth.py`

The register endpoint does not enforce password complexity (minimum length, character types, etc.).

**Suggested improvement:** Add password validation: minimum 8 characters, mixed case, numbers.

---

## 7. Disabled User Check Only at Login

**Severity:** Low | **File:** `api/auth.py`

The `enabled` field is checked during login but NOT during `get_current_user()`. A user whose account is disabled after login can continue using their JWT until it expires.

**Suggested improvement:** Add `enabled` check in `get_current_user()`.
