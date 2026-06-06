# Frontend State Management

> Generated: 2026-06-07 | Confidence: HIGH

## State Architecture

The application uses a **minimal state management approach** with no dedicated state library (no Redux, Zustand, or Context API for app state).

### State Sources

| Source | Type | Scope | Persistence |
|--------|------|-------|-------------|
| `useState` | Component-local | Per component | Session only |
| `useRef` | Mutable reference | Per component | Session only |
| `localStorage` | Browser storage | Global | Persistent |
| Axios defaults | In-memory | Global | Session only |
| TanStack Query | Cache (initialized, barely used) | Global | Session only |

---

## State by Component

### Global State (main.tsx)

| State | Type | Storage | Purpose |
|-------|------|---------|---------|
| JWT token | string | `localStorage['jwt']` | Authentication |
| Authorization header | string | `axios.defaults.headers.common['Authorization']` | API auth |
| Color mode | 'light'\|'dark' | Chakra UI internal | Theme |

### HomePage State

| State | Type | Initial | Set By |
|-------|------|---------|--------|
| `dashboards` | `Dashboard[]` | `[]` | `fetchDashboards()` |
| `loading` | `boolean` | `true` | `fetchDashboards()` |
| `error` | `string \| null` | `null` | `fetchDashboards()` catch |
| `userRoles` | `Array<string>` | `[]` | `fetchUserRoles()` |

### LoginPage State

| State | Type | Initial | Note |
|-------|------|---------|------|
| `username` | `string` | `'admin'` | Default for dev |
| `password` | `string` | `'admin'` | Default for dev |

### RegisterPage State

| State | Type | Initial |
|-------|------|---------|
| `username` | `string` | `''` |
| `email` | `string` | `''` |
| `password` | `string` | `''` |
| `passwordConfirm` | `string` | `''` |

### EditorPage State

| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| `sql` | `string` | `'SELECT * FROM dual'` | Editor content |
| `queryName` | `string` | `'Untitled'` | Save name |
| `columns` | `string[]` | `[]` | Query result columns |
| `rows` | `any[][]` | `[]` | Query result rows |
| `savedQueries` | `SavedQuery[]` | `[]` | Sidebar list |
| `isExecuting` | `boolean` | `false` | Button loading |

### ViewerPage State

| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| `items` | `DashboardItemResult[]` | `[]` | All dashboard items with data |
| `dashboardName` | `String` | `"unknown"` | Dashboard title |
| `tabs` | `DashboardTabResult[]` | `[]` | Tab definitions |
| `selectedTab` | `number \| null` | `null` | Active tab |
| `filterGroups` | `DashboardFilterGroup[]` | `[]` | Filter definitions |
| `filterValues` | `Record<string, any>` | `{}` | Current filter values |

### Chart Component State (per canvas)

| State | Type | Purpose |
|-------|------|---------|
| `tooltip` | `{x, y, lines, color, left} \| null` | Tooltip position + content |
| `hoveredPoint` | `{index, measureIndex} \| number \| null` | Hovered data point |

### Chart Class State (non-React)

| Class | Internal State |
|-------|---------------|
| BarChartItem | `cache: Array<Array<Segment>>` — Hit test cache |
| LineChartItem | `cache: Array<Array<Point>>` — Hit test cache |
| PieChartItem | `_cache: { slices, grouped, cols, rows, ... }` — Layout + hit test |

---

## Data Flow

```
API Response
  ↓ (setState)
React State
  ↓ (props / instantiation)
Chart Class
  ↓ (render)
Canvas 2D

User Interaction
  ↓ (event handler)
setState (hoveredPoint / filterValues / selectedTab)
  ↓ (re-render)
Chart re-renders with new hover state
  OR
New API call with filter values
```

---

## Auth State Flow

```
Login Success:
  localStorage.setItem('jwt', token)
  → axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  → navigate('/')

Page Mount (protected):
  const token = localStorage.getItem('jwt')
  → if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  → if (!token) navigate('/login')

401 Response (global interceptor):
  localStorage.removeItem('jwt')
  → delete axios.defaults.headers.common['Authorization']
  → window.location.replace('/login')
```

---

## State Anti-Patterns & Issues

| Issue | Location | Risk |
|-------|----------|------|
| Default credentials in useState | LoginPage `useState('admin')` | **Medium** — Security: Production builds retain default credentials |
| JWT cleared on every render | RegisterPage `useEffect` with no deps | **Low** — Unnecessary localStorage operations, but functional |
| No token expiry check | ProtectedRoute | **Medium** — Expired JWT is only caught on API call failure |
| State not synced between tabs | localStorage | **Low** — Login in one tab doesn't affect others until refresh |
| TanStack Query unused | main.tsx | **None** — QueryClient created but no `useQuery` calls exist |
| Chart cache in class instances | ChartItem classes | **Low** — Cache not invalidated on window resize |
| No loading/error boundaries | System-wide | **Medium** — Uncaught render errors crash the entire app |

---

## Recommendations

1. **Replace localStorage JWT with httpOnly cookie** — More secure against XSS
2. **Add token expiry check** in ProtectedRoute — Decode JWT and check `exp` claim
3. **Remove default credentials** — Use empty strings or environment variables
4. **Add error boundaries** — Wrap chart components to prevent full-page crashes
5. **Use TanStack Query** — Replace manual useEffect+axios with `useQuery` for caching, refetching, and loading states
6. **Fix RegisterPage useEffect** — Add `[]` dependency array
