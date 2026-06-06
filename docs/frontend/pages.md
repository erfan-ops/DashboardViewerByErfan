# Frontend Pages

> Generated: 2026-06-07 | Confidence: HIGH

## Page Overview

| Page | Route | Lines | Complexity | Purpose |
|------|-------|-------|------------|---------|
| HomePage | `/` | ~405 | Medium | Dashboard listing with role-aware UI |
| LoginPage | `/login` | ~73 | Low | OAuth2 form login |
| RegisterPage | `/register` | ~73 | Low | User registration |
| EditorPage | `/editor` | ~342 | Medium-High | SQL editor with Monaco + saved queries |
| ViewerPage | `/viewer/:id` | ~438 | Medium | Dashboard viewer with Canvas charts, tabs, filters (chart components extracted to `components/`) |

---

## HomePage (`/`)

**File:** `src/pages/HomePage.tsx` (~405 lines)

**Purpose:** Landing page that lists the user's dashboards in a responsive grid.

**Key behavior:**
1. On mount: checks for JWT, fetches dashboards (`/api/dashboards/mine`) and roles (`/api/user/roles`)
2. Displays dashboards in a responsive grid (1-4 columns)
3. Each dashboard card shows: name, description, last_opened (with relative time in Persian)
4. Cards have hover animation (translateY, shadow, arrow icon)
5. Fade-in stagger animation on load
6. **Role-aware UI:** The "ویرایشگر" (Editor) button is only shown if user has `admin` or `dashboard_editor` role
7. "داشبورد جدید" (New Dashboard) button navigates to `/create` (route NOT implemented)
8. Refresh button to re-fetch dashboards
9. Empty state with illustration and CTA when no dashboards exist

**State:**
- `dashboards: Dashboard[]` — From API
- `loading: boolean` — Loading spinner
- `error: string | null` — Error message display
- `userRoles: Array<string>` — For conditional UI rendering

**RTL:** All text in Persian, `dir="rtl"` on root elements.

---

## LoginPage (`/login`)

**File:** `src/pages/LoginPage.tsx` (~73 lines)

**Purpose:** Authenticate user and obtain JWT.

**Key behavior:**
1. On mount: if JWT exists in localStorage, auto-redirect to `/`
2. Username + password form with Enter key support
3. Submits as `application/x-www-form-urlencoded` (OAuth2 style)
4. On success: stores JWT, sets Axios header, redirects to `/`
5. On failure: shows error toast
6. "Register" button navigates to `/register`

**Default credentials (for development):** username=`admin`, password=`admin`

**Security note:** The default credentials are hardcoded in `useState` initial values for development convenience. In production, these should be removed.

---

## RegisterPage (`/register`)

**File:** `src/pages/RegisterPage.tsx` (~73 lines)

**Purpose:** Create a new user account.

**Key behavior:**
1. On mount: removes any existing JWT from localStorage
2. Form: username, email, password, confirm_password
3. Submits as `application/x-www-form-urlencoded`
4. On success: navigates to `/login`
5. Validates all fields client-side (via form submission)

**⚠️ Note:** The useEffect on this page runs on EVERY render (no dependency array), clearing the JWT each time. This is likely a bug — it should have `[]` to run only on mount.

---

## EditorPage (`/editor`)

**File:** `src/pages/EditorPage.tsx` (~342 lines)

**Purpose:** SQL query editor for dashboard editors/admins.

**Key behavior:**
1. On mount: sets JWT header, fetches saved queries
2. Monaco Editor with SQL syntax highlighting
3. Light/dark mode synced with Chakra color mode
4. "Run Query" button executes SQL and shows results in a table
5. "Save Query" button saves/updates named SQL
6. Saved queries sidebar (400px wide) with:
   - Click to load into editor
   - SQL preview with monospace font
   - Hover animation (translateY, shadow, border color)
   - Custom scrollbar styling

**State:**
- `sql: string` — Current editor content
- `queryName: string` — Name for save
- `columns: string[]`, `rows: any[][]` — Query results
- `savedQueries: SavedQuery[]` — Sidebar list
- `isExecuting: boolean` — Loading state for execute button

**SQL limit:** 200 rows for execution, 1000 for saved query variable (unused default)

---

## ViewerPage (`/viewer/:id`)

**File:** `src/pages/ViewerPage.tsx` (~438 lines after structural cleanup; chart canvas components extracted to `components/`)

**Purpose:** Render a dashboard with tabs, filter groups, and chart visualizations.

### Architecture

ViewerPage imports three chart canvas components from `components/`:
- `BarChartCanvas` — Bar chart canvas with tooltip
- `LineChartCanvas` — Line chart canvas with tooltip
- `PieChartCanvas` — Pie chart canvas with tooltip

The `renderChart()` function dispatches based on `item.item_type`:
- `"BAR"` → BarChartCanvas
- `"LIN"` → LineChartCanvas
- `"PIE"` → PieChartCanvas
- default → HTML Table

### Data Fetching (4 parallel API calls on mount)
1. `GET /api/dashboards/{id}` → dashboard name
2. `GET /api/dashboards/{id}/tabs` → tab definitions
3. `GET /api/dashboards/{id}/items` → chart data
4. `GET /api/dashboards/{id}/filter-groups` → filter definitions

### Tab System
- Tabs sorted by `display_order`
- First tab auto-selected on load
- Selected tab has solid purple style, unselected tabs are outlined
- Items filtered client-side by `tab_id`

### Filter System
- Filter groups rendered as absolutely-positioned overlays (using `position` XML)
- Filter input types based on `data_type`: NUMBER, BOOLEAN, DATE, PERSIAN_DATE, TEXT
- "تایید" (Apply) button on last filter of each group triggers: `GET /api/dashboards/{id}/items?filters={...}`
- Filter values managed in `filterValues` state (`Record<string, any>`)

### Chart Components (all follow same pattern)
1. Parse geometry XML → `{x, y, w, h}`
2. Parse attributes XML → chart configuration
3. Convert query result rows to objects
4. Instantiate chart class with Canvas 2D context
5. Render at position on `position: absolute` layer
6. Mouse move → hit test → tooltip display

### Tooltip System
- Bar/Line: Multi-line tooltip showing X value and Y value with colored bullet
- Pie: Single-line tooltip showing pie name, slice name, and value
- Tooltips auto-position to avoid overflowing canvas boundaries

### RTL & Persian
- Dashboard name in Persian font (Yekan)
- "خروج" (Exit) button
- RTL layout (`dir="rtl"`)
- Persian digit formatting via `toPersianDigits()`

### Cleaned in structural cleanup
- Removed unused `echarts` import and inline chart component definitions (now in `components/`)
