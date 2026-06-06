/** Shared types used by ViewerPage and chart canvas components. */

export interface QueryResult {
  columns: string[]
  rows: any[][]
}

export interface DashboardItemResult {
  item_id: number
  item_type: string
  display_order: number
  geometry?: string | null
  attributes?: string | null
  query_result: QueryResult
  tab_id: number
}

export interface DashboardTabResult {
  tab_id: number
  tab_name: string
  display_order?: number | null
}

export interface DashboardFilter {
  filter_id: number
  name?: string | null
  filter_key: string
  operator_type?: string | null
  data_type: string
  default_value?: string | null
  allow_empty: boolean
}

export interface DashboardFilterGroup {
  group_id: number
  name: string
  position: string
  tab_id?: number | null
  filters: DashboardFilter[]
}
