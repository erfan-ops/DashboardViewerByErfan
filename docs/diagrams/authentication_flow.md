# Authentication Flow Diagrams

> Generated: 2026-06-07 | Confidence: HIGH

## Complete Login Flow

```mermaid
sequenceDiagram
    actor User
    participant LP as LoginPage
    participant LS as localStorage
    participant Axios
    participant BE as FastAPI Backend
    participant DB as Oracle DB
    participant BG as Background Task

    User->>LP: Enter username + password
    LP->>LP: Check: JWT already in localStorage?
    alt JWT exists
        LP->>LS: Read 'jwt'
        LP->>Axios: Set Authorization header
        LP->>LP: navigate('/')
    else No JWT
        User->>LP: Click "Login"
        LP->>LP: Build URLSearchParams<br/>(form-encoded)
        LP->>Axios: POST /api/auth/login
        Note over LP,Axios: Content-Type: application/x-www-form-urlencoded

        Axios->>BE: Forward request

        BE->>DB: SELECT * FROM users WHERE USERNAME = :username
        DB-->>BE: User row

        BE->>BE: Check: user exists?
        alt User not found
            BE-->>Axios: 401 "Invalid credentials"
            Axios-->>LP: Error response
            LP->>LP: Show error toast
        else User found
            BE->>BE: Check: enabled == 1?
            alt Not enabled
                BE-->>Axios: 401 "Invalid credentials"
            else Enabled
                BE->>BE: bcrypt.checkpw(plain, hashed)
                alt Password mismatch
                    BE-->>Axios: 401 "Invalid credentials"
                else Password match
                    BE->>BE: create_access_token(subject=user.id)
                    Note over BE: JWT: { sub: "1", exp: now+120min }
                    BE-->>Axios: 200 { access_token, token_type: "bearer" }

                    BE->>BG: Background task:
                    BG->>DB: UPDATE users SET LAST_LOGIN = SYSTIMESTAMP
                    BG->>DB: UPDATE users SET UPDATED_AT = SYSTIMESTAMP
                    BG->>DB: COMMIT

                    Axios-->>LP: Token response
                    LP->>LS: setItem('jwt', token)
                    LP->>Axios: Set Authorization: Bearer <token>
                    LP->>LP: navigate('/')
                end
            end
        end
    end
```

---

## Registration Flow

```mermaid
sequenceDiagram
    actor User
    participant RP as RegisterPage
    participant Axios
    participant BE as FastAPI Backend
    participant DB as Oracle DB

    User->>RP: Enter: username, email, password, confirm_password
    RP->>RP: Check: confirm_password === password?
    Note over RP: Client-side validation only on submit
    User->>RP: Click "Register"

    RP->>RP: Build URLSearchParams<br/>(form-encoded)
    RP->>Axios: POST /api/auth/register

    Axios->>BE: Forward request

    BE->>DB: SELECT * FROM users WHERE USERNAME = :username
    DB-->>BE: Result
    alt Username exists
        BE-->>Axios: 409 "User already exists."
        Axios-->>RP: Show error toast
    else Username available
        BE->>DB: SELECT * FROM users WHERE EMAIL = :email
        DB-->>BE: Result
        alt Email exists
            BE-->>Axios: 409 "Email already registered."
            Axios-->>RP: Show error toast
        else Email available
            BE->>BE: Check password == confirm_password
            alt Mismatch
                BE-->>Axios: 401 "Passwords did not match!!!"
            else Match
                BE->>BE: bcrypt.hashpw(password, gensalt(12))
                BE->>DB: INSERT INTO USERS<br/>(ID, USERNAME, EMAIL, PASSWORD_HASH, ROLE)<br/>VALUES (user_id_seq.nextval, ...)
                BE->>DB: COMMIT
                BE-->>Axios: 200 { status: "ok" }
                Axios-->>RP: Success
                RP->>RP: navigate('/login')
            end
        end
    end
```

---

## Token Validation Flow (Per-Request)

```mermaid
sequenceDiagram
    participant Client
    participant AxiosInt as Axios Interceptor
    participant BE as FastAPI
    participant JWT as python-jose
    participant DB as Oracle DB

    Client->>AxiosInt: Any API request
    AxiosInt->>AxiosInt: Attach Authorization: Bearer <token>
    AxiosInt->>BE: Request

    BE->>BE: OAuth2PasswordBearer extracts token
    BE->>BE: get_current_user(token, db)

    BE->>JWT: jwt.decode(token, secret_key, [HS256])
    alt Invalid signature / expired
        JWT-->>BE: JWTError
        BE-->>Client: 401 "Invalid token"
        Client->>AxiosInt: 401 response handler
        AxiosInt->>AxiosInt: Remove JWT from localStorage
        AxiosInt->>AxiosInt: Clear Authorization header
        AxiosInt->>Client: window.location.replace('/login')
    else Valid token
        JWT-->>BE: { sub: user_id, exp: timestamp }
        BE->>DB: db.get(User, user_id)
        alt User not found
            DB-->>BE: None
            BE-->>Client: 401 "User not found"
        else User found
            DB-->>BE: User object
            BE->>BE: RBAC check (require_any_role)
            alt Insufficient role
                BE-->>Client: 403 "Insufficient role"
            else Authorized
                BE->>BE: Execute endpoint logic
                BE-->>Client: 200 Response
            end
        end
    end
```

---

## 401 Interceptor Flow (Frontend)

```mermaid
flowchart TD
    A[API Request] --> B[Axios sends request with Auth header]
    B --> C{Response status?}
    C -->|200| D[Process response normally]
    C -->|401| E[Axios response interceptor fires]
    C -->|Other error| F[Component catch block handles]

    E --> G[localStorage.removeItem('jwt')]
    G --> H[delete axios.defaults.headers.common Authorization]
    H --> I{Current path === '/login'?}
    I -->|Yes| J[Stay on /login<br/>Prevent redirect loop]
    I -->|No| K[window.location.replace('/login')]

    K --> L[Browser hard-reloads /login]
    L --> M[LoginPage mounts]
    M --> N{localStorage has JWT?}
    N -->|No| O[Show login form]
    N -->|Yes - leftover| P[navigate to /]
```

---

## Role Resolution Flow

```mermaid
flowchart TD
    A[get_user_role_names(user, db)] --> B[Initialize empty set]
    B --> C{user.roles exist?}
    C -->|Yes| D[For each role:<br/>normalize and add name]
    C -->|No| E{user.groups exist?}
    D --> E
    E -->|Yes| F[For each group:<br/>For each group.role:<br/>normalize and add name]
    E -->|No| G[Return role_names set]
    F --> G

    G --> H[require_any_role checks:<br/>user_roles ∩ required ≠ ∅?]
    H -->|Yes| I[Return user → endpoint executes]
    H -->|No| J[403: Insufficient role]
```
