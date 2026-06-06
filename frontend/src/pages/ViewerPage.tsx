import { useEffect, useState, useCallback } from 'react'
import { Button, Input, Checkbox, Stack, Flex } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { Container, Heading, HStack, Table, Thead, Tbody, Tr, Th, Td, Box, useToast, VStack, Divider } from '@chakra-ui/react'
import axios from 'axios'
import { BarAttributes } from '../core/BarChartItem'
import { LineAttributes } from '../core/LineChartItem'
import { PieAttributes } from '../core/PieChartItem'
import { parsePieAttributes, parseBarAttributes, parseLineAttributes, parseGeometry } from '../core/utils'
import BarChartCanvas from '../components/BarChartCanvas'
import LineChartCanvas from '../components/LineChartCanvas'
import PieChartCanvas from '../components/PieChartCanvas'
import type { QueryResult, DashboardItemResult, DashboardTabResult, DashboardFilter, DashboardFilterGroup } from '../types/dashboard'

export default function ViewerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<DashboardItemResult[]>([])
  const [dashboardName, setDashboardName] = useState<String>("unknown")
  const [tabs, setTabs] = useState<DashboardTabResult[]>([])
  const [selectedTab, setSelectedTab] = useState<number | null>(null)
  const [filterGroups, setFilterGroups] = useState<DashboardFilterGroup[]>([])
  // map filter_key -> value
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const toast = useToast()

  const fetchDashboardTabs = useCallback(async () => {
    try {
      const res = await axios.get(`/api/dashboards/${id}/tabs`)
      setTabs(res.data || [])
    } catch (e: any) {
      if (e?.response?.status === 401) navigate('/login')
      else toast({ status: 'error', title: 'Failed to fetch dashboard tabs', description: e?.response?.data?.detail || String(e) })
    }
  }, [id, navigate, toast])

  // modified to accept optional filters object
  const fetchDashboardItems = useCallback(async (filters?: Record<string, any>) => {
    if (!id) return
    try {
      const res = await axios.get(`/api/dashboards/${id}/items`, {
        params: filters ? { filters: JSON.stringify(filters) } : undefined
      })
      setItems(res.data || [])
    } catch (e: any) {
      if (e?.response?.status === 401) navigate('/login')
      else toast({ status: 'error', title: 'Failed to fetch dashboard items', description: e?.response?.data?.detail || String(e) })
    }
  }, [id, navigate, toast])

  const fetchDashboardName = useCallback(async () => {
    try {
      const res = await axios.get(`/api/dashboards/${id}`)
      setDashboardName(res.data.name)
    } catch (e: any) {
      if (e?.response?.status === 401) navigate('/login')
      else toast({ status: 'error', title: 'Failed to fetch dashboard tabs', description: e?.response?.data?.detail || String(e) })
    }
  }, [id, navigate, toast, dashboardName])

  const fetchFilterGroups = useCallback(async () => {
    if (!id) return
    try {
      const res = await axios.get(`/api/dashboards/${id}/filter-groups`)
      const groups: DashboardFilterGroup[] = res.data || []
      setFilterGroups(groups)

      // initialize filterValues with defaults
      const initial: Record<string, any> = {}
      groups.forEach(g => {
        g.filters.forEach(f => {
          if (f.default_value !== null && f.default_value !== undefined && f.default_value !== '') {
            initial[f.filter_key] = f.default_value
          } else {
            // keep empty value to let backend decide based on allow_empty
            initial[f.filter_key] = ''
          }
        })
      })
      setFilterValues(prev => ({ ...initial, ...prev }))
    } catch (e: any) {
      if (e?.response?.status === 401) navigate('/login')
      else toast({ status: 'error', title: 'Failed to fetch filter groups', description: e?.response?.data?.detail || String(e) })
    }
  }, [id, navigate, toast])

  useEffect(() => {
    const t = localStorage.getItem('jwt')
    if (t) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
      fetchDashboardItems()
      fetchDashboardTabs()
      fetchDashboardName()
      fetchFilterGroups()
    } else navigate('/login')
  }, [navigate, fetchDashboardItems, fetchDashboardTabs, fetchDashboardName, fetchFilterGroups])

  const toRowObjects = (qr: QueryResult) => {
    const { columns, rows } = qr
    return rows.map(r => {
      const obj: Record<string, any> = {}
      columns.forEach((c, i) => { obj[c] = r[i] })
      return obj
    })
  }

  // helper to parse position xml like: <item x="568" y="570"/>
  const parsePosition = (pos: string | undefined | null) => {
    if (!pos) return { x: 0, y: 0 }
    try {
      const mx = pos.match(/x\s*=\s*"([\-\d\.]+)"/)
      const my = pos.match(/y\s*=\s*"([\-\d\.]+)"/)
      const x = mx ? parseFloat(mx[1]) : 0
      const y = my ? parseFloat(my[1]) : 0
      return { x, y }
    } catch (e) {
      return { x: 0, y: 0 }
    }
  }

  // Apply handler for a filter group
  const applyGroupFilters = async (group: DashboardFilterGroup) => {
    // build filters object with provided values for this group
    const payload: Record<string, any> = {}
    group.filters.forEach(f => {
      const val = filterValues[f.filter_key]
      // include only non-empty values; backend will handle defaults/allow_empty
      if (val !== undefined && val !== null && String(val) !== '') {
        payload[f.filter_key] = val
      }
    })

    // re-fetch dashboard items with these filters
    await fetchDashboardItems(payload)
  }

  function renderChart(item: DashboardItemResult) {
    switch (item.item_type) {
      case "BAR":
        return (
        <BarChartCanvas
          item={item}
          dashboardId={Number(id || 0)}
          geom={parseGeometry(item.geometry)}
          attrs={parseBarAttributes(item.attributes)}
          data={toRowObjects(item.query_result)}
        />)
      case "LIN":
        return(<LineChartCanvas
          item={item}
          dashboardId={Number(id || 0)}
          geom={parseGeometry(item.geometry)}
          attrs={parseLineAttributes(item.attributes)}
          data={toRowObjects(item.query_result)}
        />)
      case "PIE":
        return(<PieChartCanvas
          item={item}
          dashboardId={Number(id || 0)}
          geom={parseGeometry(item.geometry)}
          attrs={parsePieAttributes(item.attributes)}
          data={toRowObjects(item.query_result)}
        />)
      default:
        return(<Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                {item.query_result.columns.map((col) => (
                  <Th key={col}>{col}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {item.query_result.rows.length === 0 ? (
                <Tr>
                  <Td colSpan={item.query_result.columns.length} textAlign="center" color="gray.500">
                    No data
                  </Td>
                </Tr>
              ) : (
                item.query_result.rows.map((row, idx) => (
                  <Tr key={idx}>
                    {row.map((cell, j) => (
                      <Td key={j}>{String(cell ?? "")}</Td>
                    ))}
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>)
    }
  }

  const sortedTabs = [...tabs].sort((a, b) => {
    const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER
    const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })

  const getItemsForTab = (tabId: number) => {
    return items.filter(item => item.tab_id === tabId)
  }

  useEffect(() => {
    if (sortedTabs.length > 0 && selectedTab === null) {
      setSelectedTab(sortedTabs[0].tab_id)
    }
  }, [sortedTabs, selectedTab])

  return (
    <Container
      backgroundColor="#e8e8e8" 
      minH="120vh"
      minW="100vw"
      p={0}  // Remove padding from outer container
    >
      {/* Header with white background - fills entire width */}
      <Box 
        bg="white" 
        pt={4}  // Keep top padding
        pb={2}  // Less bottom padding since tabs are in header
        borderRadius="none" 
        boxShadow="sm" 
        mb={6}
        dir="rtl"
        w="100%"  // Full width
        mt={0}    // No top margin
      >
        {/* Inner container to constrain content width */}
        <Container maxW="80vw" mx="auto">
          {/* Top row: Dashboard name and Exit button */}
          <HStack justify="space-between" mb={4}>
            {/* Dashboard name on the left */}
            <Heading size="lg" textAlign="right" flex="1" color="#000000ff" fontFamily="Yekan">
              {dashboardName || "TESTNAME"}
            </Heading>

            {/* Right side: Exit button */}
            <HStack spacing={4}>
              <Button
                onClick={() => navigate("/")}
                colorScheme="gray"
                variant="outline"
                height="40px"
                _hover={{
                  bg: "#f5f5f5",
                  borderColor: "#6565ec"
                }}
              >
                خروج
              </Button>
            </HStack>
          </HStack>
          
          {sortedTabs.length > 0 && (
            <Box dir="rtl">
              <HStack spacing={2}>
                {sortedTabs.map((tab) => (
                  <Button
                    key={tab.tab_id}
                    onClick={() => setSelectedTab(tab.tab_id)}
                    variant={selectedTab === tab.tab_id ? "solid" : "outline"}
                    height="36px"  // Slightly smaller for header
                    px={5}
                    _hover={{
                      bg: selectedTab === tab.tab_id ? "#4d4de6" : "rgba(101, 101, 236, 0.1)",
                      borderColor: "#6565ec",
                      color: selectedTab === tab.tab_id ? "white" : "#6565ec"
                    }}
                    sx={{
                      // Custom color scheme for selected tab
                      ...(selectedTab === tab.tab_id ? {
                        bg: "#6565ec",
                        borderColor: "#6565ec",
                        color: "white",
                        _hover: {
                          bg: "#4d4de6",
                          borderColor: "#4d4de6"
                        }
                      } : {
                        // Custom color scheme for unselected tabs
                        color: "#6565ec",
                        borderColor: "#6565ec",
                        bg: "transparent",
                        _hover: {
                          bg: "rgba(101, 101, 236, 0.1)",
                          borderColor: "#6565ec"
                        }
                      })
                    }}
                  >
                    {tab.tab_name}
                  </Button>
                ))}
              </HStack>
              <Divider mt={3} />
            </Box>
          )}
        </Container>
      </Box>
      
      {/* Main content container */}
      <Container maxW="8xl" py={6} mx="auto">
        {/* Items Section - Shows only selected tab's items */}
        {sortedTabs.length > 0 ? (
          // Tabbed view
          selectedTab ? (
            <VStack spacing={6} align="stretch">
              {getItemsForTab(selectedTab).length === 0 ? (
                <Box textAlign="center" py={8} color="gray.500">No items in this tab</Box>
              ) : (
                // Wrap a relative container so absolutely-positioned filters and items align
                <Box position="relative" w="100%">
                  {/** Render filter groups for this tab **/}
                  {filterGroups
                    .filter(g => (g.tab_id ?? null) === selectedTab)
                    .map(group => {
                      const pos = parsePosition(group.position)
                      return (
                        <Box key={group.group_id} position="absolute" style={{ top: pos.y, left: pos.x, zIndex: 20 }}>
                          <Box bg="white" p={3} borderRadius="8px" boxShadow="sm" minW="220px">
                            <Stack spacing={2}>
                              <Heading size="sm" textAlign="right">{group.name}</Heading>
                              {group.filters.map((f, index) => (
                                <Box key={f.filter_id}>
                                  <Box fontSize="13px" mb={1} textAlign="right">{f.name || f.filter_key}</Box>
                                  {/* Apply button only for the last filter */}
                                  {index === group.filters.length - 1 ? (
                                    <Flex alignItems="flex-start" gap={2}>
                                      <Button 
                                        size="sm"
                                        onClick={() => applyGroupFilters(group)}
                                        alignSelf="stretch"
                                        height="40px"
                                        width="78px"
                                        mt={0}
                                        sx={{
                                          bg: "#6565EC",
                                          color: "#FFFFFF",
                                          fontSize: "12px"
                                        }}
                                        _hover={{
                                          bg: "#8183F0",
                                        }}
                                        _focus={{
                                          bg: "#8183F0",
                                          boxShadow: "0px 0px 0px 4px rgba(221, 221, 255, 1)"
                                        }}
                                      >
                                        تایید
                                      </Button>
                                      <Box flex="1">
                                        {(() => {
                                          const val = filterValues[f.filter_key] ?? ''
                                          switch ((f.data_type || '').toUpperCase()) {
                                            case 'NUMBER':
                                              return <Input
                                                type="number"
                                                value={val}
                                                onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))}
                                                sx={{
                                                  bg: "rgba(255, 255, 255, 1)",
                                                  border: "1.4px solid var(--Colors-Additional-Border-1, rgba(237, 237, 242, 1))"
                                                }}
                                                _hover={{
                                                  border: "1.4px solid var(--Colors-Brand-Primary, rgba(101, 101, 236, 1))"
                                                }}
                                                _focus={{
                                                  border: "1.4px solid var(--Colors-Brand-Primary, rgba(101, 101, 236, 1))",
                                                  boxShadow: "0px 0px 0px 3px rgba(221, 221, 255, 1)"
                                                }}
                                              />
                                            case 'BOOLEAN':
                                              return <Checkbox isChecked={!!val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.checked }))} />
                                            case 'DATE':
                                              return <Input type="date" value={val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))} />
                                            default:
                                              return <Input type="text" value={val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))} />
                                          }
                                        })()}
                                      </Box>
                                    </Flex>
                                  ) : (
                                    <>
                                      {(() => {
                                        const val = filterValues[f.filter_key] ?? ''
                                        switch ((f.data_type || '').toUpperCase()) {
                                          case 'NUMBER':
                                            return <Input type="number" value={val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))} />
                                          case 'BOOLEAN':
                                            return <Checkbox isChecked={!!val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.checked }))} />
                                          case 'DATE':
                                          case 'PERSIAN_DATE':
                                            return <Input type="date" value={val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))} />
                                          default:
                                            return <Input type="text" value={val} onChange={e => setFilterValues(prev => ({ ...prev, [f.filter_key]: e.target.value }))} />
                                        }
                                      })()}
                                    </>
                                  )}
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        </Box>
                      )
                    })}

                  {/** Render items for this tab **/}
                  {getItemsForTab(selectedTab).map((item) => (
                    <Box key={item.item_id}>
                      {renderChart(item)}
                    </Box>
                  ))}
                </Box>
              )}
            </VStack>
          ) : null
        ) : (
          // Legacy view (for dashboards without tabs)
          items.length === 0 ? (
            <Box textAlign="center" py={8} color="gray.500">No dashboard items found</Box>
          ) : (
            <VStack spacing={6} align="stretch">
              {items.map((item) => (
                <Box key={item.item_id}>
                  {renderChart(item)}
                </Box>
              ))}
            </VStack>
          )
        )}
      </Container>
    </Container>
  )
}
