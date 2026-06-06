# Frontend Architecture Diagrams

> Generated: 2026-06-07 | Confidence: HIGH

## Component Tree

```mermaid
graph TD
    ROOT["<html> #root"]
    STRICT["React.StrictMode"]
    CMS["ColorModeScript"]
    CHAKRA["ChakraProvider<br/>theme=theme"]
    QC["QueryClientProvider<br/>client=queryClient"]
    ROUTER["RouterProvider<br/>router=router"]

    ROOT --> STRICT
    STRICT --> CMS
    STRICT --> CHAKRA
    CHAKRA --> QC
    QC --> ROUTER

    ROUTER --> HOME["/ → HomePage"]
    ROUTER --> LOGIN["/login → LoginPage"]
    ROUTER --> REG["/register → RegisterPage"]
    ROUTER --> EDITOR["/editor → ProtectedRoute → EditorPage"]
    ROUTER --> VIEWER["/viewer/:id → ProtectedRoute → ViewerPage"]

    EDITOR --> PR1["ProtectedRoute<br/>checks localStorage.jwt"]
    VIEWER --> PR2["ProtectedRoute<br/>checks localStorage.jwt"]

    LOGIN --> TT1["ThemeToggle"]
    REG --> TT2["ThemeToggle"]
    EDITOR --> TT3["ThemeToggle"]
    EDITOR --> MONACO["@monaco-editor/react"]

    HOME --> GRID["SimpleGrid<br/>Dashboard Cards"]
    HOME --> NEW_BTN["New Dashboard Button"]
    HOME --> EDITOR_BTN["Editor Button<br/>(role-conditional)"]

    VIEWER --> HEADER["Header<br/>Dashboard Name + Exit"]
    VIEWER --> TABS["Tab Buttons"]
    VIEWER --> FILTERS["Filter Groups<br/>(positioned absolute)"]
    VIEWER --> CHARTS["Chart Canvas<br/>(positioned absolute)"]

    CHARTS --> BAR["BarChartCanvas<br/>→ BarChartItem"]
    CHARTS --> LINE["LineChartCanvas<br/>→ LineChartItem"]
    CHARTS --> PIE["PieChartCanvas<br/>→ PieChartItem"]
    CHARTS --> TABLE["HTML Table<br/>(fallback)"]
```

---

## Data Fetching Flow (ViewerPage)

```mermaid
sequenceDiagram
    participant VP as ViewerPage
    participant Axios
    participant BE as Backend

    Note over VP: useEffect on mount

    par "Parallel fetch 1"
        VP->>Axios: GET /api/dashboards/{id}
        Axios-->>VP: { id, name, description }
        VP->>VP: setDashboardName(name)
    and "Parallel fetch 2"
        VP->>Axios: GET /api/dashboards/{id}/tabs
        Axios-->>VP: [{ tab_id, tab_name, display_order }]
        VP->>VP: setTabs(data)
    and "Parallel fetch 3"
        VP->>Axios: GET /api/dashboards/{id}/items
        Note over BE: Resolve SQL + filters<br/>Execute queries
        Axios-->>VP: [{ item_id, item_type, query_result, geometry, attributes, tab_id }]
        VP->>VP: setItems(data)
    and "Parallel fetch 4"
        VP->>Axios: GET /api/dashboards/{id}/filter-groups
        Axios-->>VP: [{ group_id, name, position, filters }]
        VP->>VP: setFilterGroups(data)
        VP->>VP: setFilterValues(init from defaults)
    end

    VP->>VP: Select first tab (sorted by display_order)
    VP->>VP: Filter items by selectedTab
    VP->>VP: Render charts for visible items
```

---

## Chart Rendering Lifecycle

```mermaid
flowchart TD
    A[ViewerPage receives items] --> B{For each item<br/>in selected tab}
    B --> C{item_type?}
    C -->|BAR| D[parseGeometry + parseBarAttributes]
    C -->|LIN| E[parseGeometry + parseLineAttributes]
    C -->|PIE| F[parseGeometry + parsePieAttributes]
    C -->|default| G[Render Chakra Table]

    D --> H[toRowObjects: columns + rows → Record[]]
    E --> H
    F --> H

    H --> I[Create BarChartCanvas component]
    H --> J[Create LineChartCanvas component]
    H --> K[Create PieChartCanvas component]

    I --> L[initChart callback]
    L --> M["new BarChartItem(id, dashboardId, order, geom, attrs, data, ctx)"]
    M --> N["chart.render(null)"]
    N --> O["Canvas 2D draws bars, grid, labels, title, totals"]

    O --> P[User moves mouse]
    P --> Q["getSliceAtCursor(mouseX, mouseY)"]
    Q --> R{Hit?}
    R -->|Yes| S["setHoveredPoint({index, measureIndex})"]
    S --> T["chart.render(hoveredPoint)"]
    T --> U["Re-draw with highlighted segment<br/>Show tooltip"]
    R -->|No| V["clearHover → render(null)"]
```

---

## Filter Application Flow

```mermaid
sequenceDiagram
    actor User
    participant VP as ViewerPage
    participant State as React State
    participant Axios

    User->>VP: Change filter value in input
    VP->>State: setFilterValues({ ...prev, [key]: newValue })
    Note over State: Local state update only<br/>No API call yet

    User->>VP: Click "تایید" (Apply) button
    VP->>VP: Build payload from filterValues<br/>for this group's filters
    VP->>VP: Remove empty values from payload

    VP->>Axios: GET /api/dashboards/{id}/items?filters={"key":"value"}
    Note over Axios: Backend resolves filters<br/>replaces {{filter:key}} placeholders<br/>executes SQL with params

    Axios-->>VP: Updated items with filtered data
    VP->>State: setItems(newData)
    VP->>VP: Re-render charts with new data
    Note over VP: Charts re-instantiated<br/>or re-rendered with new data
```
