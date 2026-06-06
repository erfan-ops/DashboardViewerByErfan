# Frontend API Integration

> Generated: 2026-06-07 | Confidence: HIGH

## HTTP Client Setup

**Library:** Axios ^1.7.2

**Base configuration:** No `baseURL` set — relies on Vite proxy in development.

### Vite Proxy Configuration

```typescript
// vite.config.ts
server: {
  port: 5173,
  proxy: {
    '/api': 'http://127.0.0.1:8000',
    '/auth': 'http://127.0.0.1:8000'
  }
}
```

In development, requests to `/api/*` and `/auth/*` are proxied to the FastAPI backend at `:8000`. In production, a reverse proxy (nginx) would handle this.

---

## Authentication Header Management

### Setting the Token

```typescript
// After successful login (LoginPage)
localStorage.setItem('jwt', t)
axios.defaults.headers.common['Authorization'] = `Bearer ${t}`

// On page mount (HomePage, EditorPage, ViewerPage)
const t = localStorage.getItem('jwt')
if (t) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
}
```

### Clearing the Token

```typescript
// Global 401 interceptor (main.tsx)
localStorage.removeItem('jwt')
delete axios.defaults.headers.common['Authorization']
window.location.replace('/login')
```

---

## 401 Interceptor (Global)

Registered in `main.tsx` at app startup:

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      try {
        localStorage.removeItem('jwt')
        delete axios.defaults.headers.common['Authorization']
      } catch {}
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  }
)
```

**Key behavior:**
- Only triggers on 401 responses
- Prevents redirect loops by checking if already on `/login`
- Uses `window.location.replace()` (hard redirect) rather than React Router navigation — this clears all React state
- Wraps localStorage operations in try/catch for environments where localStorage is blocked

**Downside:** The `replace()` call loses any in-progress work (e.g., unsaved editor SQL).

---

## API Call Patterns

### Pattern 1: Form-Encoded POST (Auth)

Used for login and register endpoints:

```typescript
const params = new URLSearchParams()
params.append('username', username)
params.append('password', password)

const res = await axios.post('/api/auth/login', params, {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
})
```

### Pattern 2: JSON POST (Editor)

```typescript
const res = await axios.post('/api/editor/sql/execute', {
  sql,
  limit: 200
})
```

### Pattern 3: GET (Dashboard Data)

```typescript
const res = await axios.get('/api/dashboards/mine')
```

### Pattern 4: GET with Query Params (Filtered Items)

```typescript
const res = await axios.get(`/api/dashboards/${id}/items`, {
  params: filters ? { filters: JSON.stringify(filters) } : undefined
})
```

---

## Error Handling Pattern

All API calls follow a consistent try/catch pattern:

```typescript
try {
  const res = await axios.get('/api/...')
  // Success: update state
} catch (e: any) {
  if (e?.response?.status === 401) {
    navigate('/login')  // or handled by global interceptor
  } else {
    toast({
      status: 'error',
      title: 'Failed to ...',
      description: e?.response?.data?.detail || String(e)
    })
  }
}
```

**Note:** The 401 check in try/catch blocks is somewhat redundant since the global interceptor also handles 401. The global interceptor fires first, causing a page redirect before the catch block executes.

---

## API Call Inventory

| Page | API Call | Method | URL | Trigger |
|------|----------|--------|-----|---------|
| LoginPage | login | POST | `/api/auth/login` | Button click / Enter |
| RegisterPage | register | POST | `/api/auth/register` | Button click / Enter |
| HomePage | fetchDashboards | GET | `/api/dashboards/mine` | Page mount, refresh button |
| HomePage | fetchUserRoles | GET | `/api/user/roles` | Page mount |
| EditorPage | execute | POST | `/api/editor/sql/execute` | "Run Query" button |
| EditorPage | save | POST | `/api/editor/sql/save` | "Save Query" button |
| EditorPage | fetchSavedQueries | GET | `/api/editor/sql/saved` | Page mount, after save |
| ViewerPage | fetchDashboardName | GET | `/api/dashboards/{id}` | Page mount |
| ViewerPage | fetchDashboardTabs | GET | `/api/dashboards/{id}/tabs` | Page mount |
| ViewerPage | fetchDashboardItems | GET | `/api/dashboards/{id}/items` | Page mount, filter apply |
| ViewerPage | fetchFilterGroups | GET | `/api/dashboards/{id}/filter-groups` | Page mount |

---

## TanStack Query

**Initialized but NOT actively used:**

```typescript
// main.tsx
const queryClient = new QueryClient()

// QueryClientProvider wraps the app
<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>
```

No components use `useQuery` or `useMutation` — all data fetching is manual via `useEffect` + axios. This represents significant untapped potential for:

- Automatic caching
- Background refetching
- Loading/error state normalization
- Request deduplication
- Cache invalidation

---

## Request/Response Types

### TypeScript Interfaces (ViewerPage)

```typescript
interface QueryResult {
  columns: string[]
  rows: any[][]
}

interface DashboardItemResult {
  item_id: number
  item_type: string        // "BAR" | "LIN" | "PIE" | default
  display_order: number
  geometry?: string | null // XML
  attributes?: string | null // XML
  query_result: QueryResult
  tab_id: number
}

interface DashboardFilterGroup {
  group_id: number
  name: string
  position: string         // XML
  tab_id?: number | null
  filters: DashboardFilter[]
}
```

### TypeScript Interfaces (HomePage)

```typescript
interface Dashboard {
  id: string
  name: string
  description?: string
  last_opened?: string
}
```

### TypeScript Interfaces (EditorPage)

```typescript
interface SavedQuery {
  name: string
  sql_text: string
}
```
