# Frontend Components

> Generated: 2026-06-07 | Confidence: HIGH

## Component Inventory

| Component | Type | Lines | Reused In |
|-----------|------|-------|-----------|
| ProtectedRoute | Auth wrapper | ~18 | EditorPage, ViewerPage (via router) |
| ThemeToggle | UI control | ~19 | LoginPage, RegisterPage, EditorPage |
| BarChartCanvas | Chart wrapper | ~190 | ViewerPage |
| LineChartCanvas | Chart wrapper | ~195 | ViewerPage |
| PieChartCanvas | Chart wrapper | ~115 | ViewerPage |

---

## ProtectedRoute

**File:** `src/components/ProtectedRoute.tsx`

**Purpose:** Auth guard that wraps protected pages. Checks for JWT in localStorage.

```tsx
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('jwt')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
```

**Usage:**
```tsx
{
  path: '/editor',
  element: (
    <ProtectedRoute>
      <EditorPage />
    </ProtectedRoute>
  )
}
```

**Limitations:**
- Does NOT validate token expiry (just checks existence)
- Does NOT check user roles (role enforcement is server-side)
- Uses `localStorage` directly (no abstraction)

---

## ThemeToggle

**File:** `src/components/ThemeToggle.tsx`

**Purpose:** Light/dark mode toggle button using Chakra UI's color mode.

```tsx
export default function ThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode()
  const icon = useColorModeValue(<MoonIcon />, <SunIcon />)
  // Dark mode → Sun icon (switch to light)
  // Light mode → Moon icon (switch to dark)
  return (
    <IconButton
      aria-label={label}
      icon={icon}
      onClick={toggleColorMode}
      variant="ghost"
    />
  )
}
```

**Reused in:** LoginPage, RegisterPage, EditorPage (imported directly).

**Note:** Not used in HomePage or ViewerPage — these pages don't provide a theme toggle.

---

## BarChartCanvas

**File:** `src/components/BarChartCanvas.tsx` (extracted from `ViewerPage.tsx` during structural cleanup)

**Purpose:** Wraps `BarChartItem` with React lifecycle management and tooltip overlay.

**Props:**
```typescript
interface BarChartCanvasProps {
  item: DashboardItemResult
  dashboardId: number
  geom: any
  attrs: BarAttributes
  data: Record<string, any>[]
}
```

**Lifecycle:**
1. `initChart` callback: Creates canvas 2D context, instantiates `BarChartItem`, calls `render(null)`
2. `useEffect`: Re-renders chart when `hoveredPoint` state changes
3. Hover detection: `getSliceAtCursor(mouseX, mouseY)` for hit testing

**Tooltip:** Multi-line with colored bullet indicator. Auto-positioned within canvas bounds.

**Rendering:** Canvas positioned absolutely at `(geom.x, geom.y)`.

---

## LineChartCanvas

**File:** `src/components/LineChartCanvas.tsx` (extracted from `ViewerPage.tsx` during structural cleanup)

**Purpose:** Same pattern as BarChartCanvas but wraps `LineChartItem`.

**Tooltip:** Shows X field name + value, Y measure name + value, with colored bullet and border styling (backdrop blur, rgba background).

---

## PieChartCanvas

**File:** `src/components/PieChartCanvas.tsx` (extracted from `ViewerPage.tsx` during structural cleanup)

**Purpose:** Same pattern but wraps `PieChartItem`.

**Tooltip:** Single-line showing: `pieName: sliceName: value`

**Hit detection:** Uses the cached `_cache.slices` array from the PieChartItem for precise radial + angular hit testing.

---

## Chart Class Hierarchy

These are not React components — they are plain TypeScript classes that render to Canvas 2D.

```
DashboardItem (abstract)
├── BarChartItem   (type: "BAR")
├── LineChartItem  (type: "LIN")
└── PieChartItem   (type: "LIN" — ⚠️ should be "PIE")
```

**DashboardItem** (`src/core/DashboardItem.ts`):
```typescript
export abstract class DashboardItem {
  id: number
  dashboardId: number
  type: string
  order: number
  geometry: Geometry  // { x, y, w, h }
  ctx: CanvasRenderingContext2D
  abstract render(hoveredIndex: any): void
}
```

### BarChartItem (`src/core/BarChartItem.ts`, ~477 lines)

**Chart type:** Stacked vertical bar chart (horizontal type supported in attributes but vertical is enforced)

**Key features:**
- Stacked bars with multiple measures
- Per-segment color from measure config
- Rounded top on the topmost segment
- Hover highlighting (lighten effect)
- Grid lines with Y-axis value labels
- X-axis category labels below bars
- Per-bar total labels above stacks
- Summary total display (optional with suffix)
- Legend for multi-measure mode
- Icon overlay (bill.svg) in top-right corner
- Persian digit conversion on all numbers

**Attributes XML format:**
```xml
<barChart type="vertical">
  <title text="Sales" color="#333" alignment="center"/>
  <axes>
    <xAxis>
      <field name="REGION" label="Region"/>
    </xAxis>
    <yAxis>
      <measure name="AMOUNT" label="Amount" color="#6565ec"/>
    </yAxis>
  </axes>
  <appearance>
    <background color="#ffffff"/>
    <grid color="#dddddd" show="true"/>
    <labels color="#222222" font="Vazir" size="12"/>
  </appearance>
  <summary include="true">
    <sum suffix="ریال"/>
  </summary>
</barChart>
```

### LineChartItem (`src/core/LineChartItem.ts`, ~240 lines)

**Chart type:** Multi-line chart with gradient fill.

**Key features:**
- Multiple measures rendered as separate lines
- Glow effect around data points
- Gradient fill below each line
- Hover highlighting on points
- Grid lines
- X-axis labels
- Optional title

### PieChartItem (`src/core/PieChartItem.ts`, ~476 lines)

**Chart type:** Multi-pie donut chart (grid layout).

**Key features:**
- Multiple pies in a responsive grid
- Donut-style arcs (thin + thick arc per slice)
- Percentage labels on slices (>4%)
- Pie name labels above each pie
- Sum total displayed in center of each pie
- Global horizontal legend at bottom (with text wrapping)
- Hover highlighting
- Color palette with 30 default colors
- Precise hit detection: radial distance check + angle check

**Attributes XML format:**
```xml
<pie colors="#3b82f6,#ef4444,..." slice="CATEGORY"
     measure="AMOUNT" pies="REGION" lineWidth="50"
     radius="60" labelColor="#222" labelFont="Vazir"
     labelFontSize="12" title="Sales" titleColor="#333"
     titleAlignment="center" backgroundColor="#fff"/>
```

**⚠️ Bug in parsePieAttributes:** The attribute "measure" is parsed as `pie.getAttribute('messure')` (misspelled) — line 401 of utils.ts. This means the `measure` attribute always falls back to the default value "measure".

---

## Chart Utility Functions

**File:** `src/core/utils.ts` (~400 lines)

| Function | Purpose |
|----------|---------|
| `lightenColor(hex, amount)` | Lighten a hex color towards white |
| `addOpacity(hex, amount)` | Adjust alpha of a hex color, return rgba |
| `toPersianDigits(text)` | Convert 0-9 to ۰-۹ Persian digits |
| `formatWithThousandSeparators(num)` | Format number with Persian comma separator (،) |
| `parseGeometry(xml)` | Parse `<item x="..." y="..." w="..." h="..."/>` |
| `parseBarAttributes(xml)` | Parse bar chart XML → BarAttributes with defaults |
| `parseLineAttributes(xml)` | Parse line chart XML → LineAttributes with defaults |
| `parsePieAttributes(xml)` | Parse pie chart XML → PieAttributes with defaults |

All parse functions provide complete default values — if XML is null, missing, or malformed, they return a fully populated defaults object.
