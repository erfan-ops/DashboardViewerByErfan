# Pitfalls: Frontend

> Generated: 2026-06-07 | Confidence: HIGH

## 1. RegisterPage useEffect Without Dependencies

**Severity:** Medium | **File:** `RegisterPage.tsx` lines 15-20

```typescript
useEffect(() => {
  const t = localStorage.getItem('jwt')
  if (t) {
    localStorage.removeItem('jwt')
  }
})  // ⚠️ No dependency array — runs on EVERY render
```

**Why it's risky:** This causes unnecessary localStorage reads/writes on every render. While not functionally broken, it wastes resources and indicates a React lifecycle misunderstanding.

**Fix:** Add `[]` dependency array.

---

## 2. Canvas Charts Not Responsive

**Severity:** Medium | **Files:** All chart components in ViewerPage

Chart dimensions are parsed from XML geometry at mount time and never updated. Window resizing does not trigger chart re-rendering at the new dimensions.

**Why it exists:** The chart system uses fixed-position canvas elements specified in XML attributes.

**Suggested improvement:** Add a ResizeObserver to re-render charts when their container size changes.

---

## 3. Unused `echarts` Import

**Severity:** Low | **File:** `ViewerPage.tsx` line 11

```typescript
import { color } from 'echarts'
```

The `echarts` package is listed as a dependency but never actually used for chart rendering. The `color` import is unused in the code. This adds unnecessary bundle size.

**Fix:** Remove the import and the `echarts` dependency from package.json.

---

## 4. Chart Cache Not Invalidated

**Severity:** Low | **Files:** `BarChartItem.ts`, `LineChartItem.ts`, `PieChartItem.ts`

Chart classes maintain internal caches (`this.cache`, `this._cache`) for hit testing. These caches are only updated on `render()`. If the underlying geometry changes (e.g., container resize), the cache is not invalidated.

---

## 5. Hardcoded Default Credentials

**Severity:** Medium | **File:** `LoginPage.tsx` lines 8-9

```typescript
const [username, setUsername] = useState('admin')
const [password, setPassword] = useState('admin')
```

Default login credentials are hardcoded in the source code for development convenience.

**Why it's risky:** Production builds retain these defaults, providing a starting point for unauthorized access attempts.

**Fix:** Use empty strings or environment variables (`import.meta.env.VITE_DEFAULT_USER`).

---

## 6. 401 Handler Uses Hard Redirect

**Severity:** Medium | **File:** `main.tsx` line 88

```typescript
window.location.replace('/login')
```

**Why it exists:** Clears all React state to prevent stale data after auth failure.

**Why it's risky:** Any unsaved work (e.g., SQL in the editor) is silently lost.

**Suggested improvement:** Show a "Session expired" notification before redirecting, or attempt token refresh first.

---

## 7. `lightenColorHex2Hex` Defined but Never Called

**Severity:** Low | **File:** `core/utils.ts` lines 36-62

The function `lightenColorHex2Hex` is fully implemented but never imported or called anywhere.

**Fix:** Remove dead code.

---

## 8. `messure` Typo in Pie Attribute Parsing

**Severity:** High | **File:** `core/utils.ts` line 401

```typescript
measure: pie.getAttribute('messure') || defaults.measure,
//                              ^^^^^^^ typo
```

The attribute is misspelled as `messure` instead of `measure`. This means the `measure` attribute in pie chart XML is never read, and the code always falls back to the default value `"measure"`.

**Impact:** All pie charts use the literal column name `"measure"` regardless of what's configured in the XML attributes. This likely breaks chart data binding.

**Fix:** Change `'messure'` to `'measure'`.

---

## 9. PieChartItem Uses Wrong Type

**Severity:** Low | **File:** `PieChartItem.ts` line 71

```typescript
super(id, dashboardId, "LIN", order, geometry, ctx);
//                        ^^^^^ should be "PIE"
```

Pie chart items are created with type "LIN" (line) instead of "PIE". This affects `this.type` property but the ViewerPage dispatches based on `item.item_type` from the backend, not this internal type. So this bug has no observable effect currently.

**Fix:** Change to `"PIE"` for correctness.
