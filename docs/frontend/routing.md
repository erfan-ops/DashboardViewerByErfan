# Frontend Routing

> Generated: 2026-06-07 | Confidence: HIGH

## Router Configuration

The application uses **React Router v6** with `createBrowserRouter`:

```typescript
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/editor',
    element: (
      <ProtectedRoute>
        <EditorPage />
      </ProtectedRoute>
    )
  },
  {
    path: '/viewer/:id',
    element: (
      <ProtectedRoute>
        <ViewerPage />
      </ProtectedRoute>
    )
  },
])
```

## Route Table

| Path | Component | Protected | Auth Required | Params |
|------|-----------|-----------|---------------|--------|
| `/` | HomePage | No | No (redirects to /login if no JWT) | — |
| `/login` | LoginPage | No | No | — |
| `/register` | RegisterPage | No | No | — |
| `/editor` | EditorPage | Yes | dashboard_editor or admin | — |
| `/viewer/:id` | ViewerPage | Yes | dashboard_viewer, editor, or admin | id: number |

## Route Transitions

### Login Flow
```
Any protected route → (no JWT) → /login → (successful login) → /
```

### Registration Flow
```
/login → (click Register) → /register → (successful registration) → /login
```

### Dashboard Navigation
```
/ (HomePage) → (click dashboard card) → /viewer/:id
/ (HomePage) → (click "ویرایشگر" button) → /editor
/ (HomePage) → (click "داشبورد جدید") → /create (NOT IMPLEMENTED)
```

### Viewer Navigation
```
/viewer/:id → (click "خروج" button) → /
/viewer/:id → (switch tab) → same URL, client-side state change
```

### 401 Interceptor (Global)
```
Any page → (API returns 401) → clear JWT → window.location.replace('/login')
```

## Navigation Methods

| Method | Used By | Purpose |
|--------|---------|---------|
| `useNavigate()` | LoginPage, RegisterPage, HomePage, EditorPage | Programmatic navigation after actions |
| `<Navigate to="/login" replace />` | ProtectedRoute | Redirect when no JWT |
| `window.location.replace('/login')` | Axios 401 interceptor | Hard redirect to avoid stale state |
| `<Link>` / router `<Navigate>` | (not used) | — |

## Route Parameters

### `/viewer/:id`
- `id` is parsed from `useParams()` as a string
- Used to fetch dashboard data: `/api/dashboards/${id}/items`
- Converted to `Number(id)` for chart instantiation

## Not Implemented

| Path | Behavior |
|------|----------|
| `/create` | Navigated to from HomePage's "Create Dashboard" button, but no route registered → 404 |
| `*` (catch-all) | No 404 page defined |
