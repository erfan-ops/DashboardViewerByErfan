# Frontend Overview

> Generated: 2026-06-07 | Confidence: HIGH

## Architecture

The frontend is a **React 18 Single Page Application (SPA)** built with TypeScript and Vite. It uses **Chakra UI** for the component library and renders data visualizations via **custom Canvas 2D chart classes**.

```
frontend/src/
├── main.tsx              # App entry: providers, router, fonts, 401 interceptor
├── theme.ts              # Chakra UI theme config (light mode default)
├── components/           # Shared UI components
│   ├── ProtectedRoute.tsx  # Auth guard wrapper
│   ├── ThemeToggle.tsx     # Light/dark mode toggle
│   ├── BarChartCanvas.tsx  # Bar chart wrapper (extracted from ViewerPage)
│   ├── LineChartCanvas.tsx # Line chart wrapper (extracted from ViewerPage)
│   └── PieChartCanvas.tsx  # Pie chart wrapper (extracted from ViewerPage)
├── core/                 # Chart engine + utilities
│   ├── DashboardItem.ts   # Abstract chart base class
│   ├── BarChartItem.ts   # Canvas 2D stacked bar chart
│   ├── LineChartItem.ts   # Canvas 2D multi-line chart
│   ├── PieChartItem.ts   # Canvas 2D multi-pie donut chart
│   └── utils.ts          # Colors, Persian digits, XML parsers
├── types/                # Shared TypeScript interfaces
│   └── dashboard.ts       # Dashboard item, filter, tab types
└── pages/                # Route-level page components
    ├── HomePage.tsx       # Dashboard listing
    ├── LoginPage.tsx      # User login
    ├── RegisterPage.tsx   # User registration
    ├── EditorPage.tsx     # SQL editor (Monaco)
    └── ViewerPage.tsx     # Dashboard viewer with charts
```

## Technology Choices

| Choice | Why |
|--------|-----|
| **Vite** | Fast dev server with HMR, proxy to backend, modern build |
| **Chakra UI** | Accessible component library with built-in light/dark mode |
| **React Router v6** | Declarative routing with data loader support (not used yet) |
| **Axios** | HTTP client with interceptors for auth token management |
| **Custom Canvas 2D** | Full control over Persian digits, RTL layout, chart styling |
| **TanStack Query** | Initialized but barely used — most data fetching is via useEffect + axios |
| **Monaco Editor** | Full-featured SQL editor with syntax highlighting |

## Rendering Pipeline

```
Backend API Response
  ↓
ViewerPage: parse response into typed interfaces
  ↓
parseGeometry(xml) → { x, y, w, h }
parseAttributes(xml) → ChartConfig (BarAttributes / LineAttributes / PieAttributes)
toRowObjects(query_result) → Record<string, any>[]
  ↓
new ChartItem(id, dashboardId, order, geometry, attributes, data, ctx)
  ↓
chart.render(hoveredParam)
  ↓
Canvas 2D API → screen
```

## Key Frontend Characteristics

| Characteristic | Detail |
|---------------|--------|
| Language | TypeScript 5.5 (strict mode) |
| Direction | RTL (Persian/Farsi) |
| Font | Yekan (primary), Vazir (fallback) — loaded via @font-face |
| Numbers | Persian digits (۰۱۲۳۴۵۶۷۸۹) via `toPersianDigits()` |
| Thousand separator | Persian comma (،) via `formatWithThousandSeparators()` |
| Color mode | Light default, dark supported via Chakra |
| Bundle | ESNext modules, noEmit (Vite handles bundling) |

## Navigation Map

```
/login ─────────────────────────────────────────────┐
  │ (successful login)                               │
  ▼                                                  │
/ (HomePage) ←───────────────────────────────────────┤
  │                                                   │
  ├──▶ /viewer/:id (ViewerPage) [protected]           │
  ├──▶ /editor (EditorPage) [protected]              │
  └──▶ /create (navigated to, but not implemented)    │
                                                        │
/register ──▶ /login (after registration)             │
                                                        │
Any route (401 response) ─────────────────────────────┘
```

**Protected routes** (`/editor`, `/viewer/:id`) check for JWT in localStorage. If missing, the user is redirected to `/login`. The 401 Axios interceptor provides a second line of defense — any 401 API response clears the token and redirects to `/login`.
