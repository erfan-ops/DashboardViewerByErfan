import { useEffect, useState, useCallback, useRef } from 'react'
import { Button, Input, Select, Checkbox, Stack, Flex, Spacer } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { Container, Heading, HStack, Table, Thead, Tbody, Tr, Th, Td, Box, useToast, VStack, Divider } from '@chakra-ui/react'
import axios from 'axios'
import { BarChartItem, BarAttributes } from '../core/BarChartItem'
import { LineChartItem, LineAttributes } from '../core/LineChartItem'
import { PieChartItem, PieAttributes } from '../core/PieChartItem'
import { toPersianDigits } from '../core/utils'
import { parsePieAttributes, parseBarAttributes, parseLineAttributes, parseGeometry } from '../core/utils'
import { color } from 'echarts'

interface QueryResult {
  columns: string[]
  rows: any[][]
}

interface DashboardItemResult {
  item_id: number
  item_type: string
  display_order: number
  geometry?: string | null
  attributes?: string | null
  query_result: QueryResult
  tab_id: number
}

interface DashboardTabResult {
  tab_id: number
  tab_name: string
  display_order?: number | null
}

// New frontend filter types
interface DashboardFilter {
  filter_id: number
  name?: string | null
  filter_key: string
  operator_type?: string | null
  data_type: string
  default_value?: string | null
  allow_empty: boolean
}

interface DashboardFilterGroup {
  group_id: number
  name: string
  position: string
  tab_id?: number | null
  filters: DashboardFilter[]
}

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

  interface BarChartCanvasProps {
    item: DashboardItemResult;
    dashboardId: number;
    geom: any;
    attrs: BarAttributes;
    data: Record<string, any>[];
  }

  interface LineChartCanvasProps {
    item: DashboardItemResult;
    dashboardId: number;
    geom: any;
    attrs: LineAttributes;
    data: Record<string, any>[];
  }

  interface PieChartCanvasProps {
    item: DashboardItemResult;
    dashboardId: number;
    geom: any;
    attrs: PieAttributes;
    data: Record<string, any>[];
  }

  // (LineChartCanvas, PieChartCanvas, BarChartCanvas and renderChart remain unchanged)
  // For brevity I keep the chart components as-is by copying the existing implementations

  function LineChartCanvas({ item, dashboardId, geom, attrs, data }: LineChartCanvasProps) {
    const [tooltip, setTooltip] = useState<{ 
      x: number; 
      y: number; 
      lines: string[];
      color: string;
      left: boolean;
    } | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ index: number; measureIndex: number } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<LineChartItem | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    const initChart = useCallback((el: HTMLCanvasElement | null) => {
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;

      ctxRef.current = ctx;
      canvasRef.current = el;
      
      const chart = new LineChartItem(
        item.item_id,
        dashboardId,
        item.display_order,
        geom,
        attrs,
        data,
        ctxRef.current
      );
      chartRef.current = chart;
      chart.render(null);
    }, [item, dashboardId, geom, attrs, data]);

    useEffect(() => {
      if (ctxRef.current && chartRef.current) {
        chartRef.current.render(hoveredPoint);
      }
    }, [hoveredPoint]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !chartRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const point = chartRef.current.getSliceAtCursor(mouseX, mouseY);
      setHoveredPoint(point);

      if (!point) {
        setTooltip(null);
        return;
      }

      // Build multi-line tooltip content
      const xField = attrs.axes.xAxis.fields[0];
      const measure = attrs.axes.yAxis.measures[point.measureIndex];
      const xValue = data[point.index][xField.name];
      const yValue = data[point.index][measure.name];

      const lines = [
        `${xField.label || 'X'}: ${xValue}`,
        `${measure.label || 'Y'}: ${yValue}`
      ];

      // Calculate tooltip dimensions for positioning
      const LINE_HEIGHT = 20;
      const CHAR_WIDTH = 8;
      const PADDING_X = 16;
      const PADDING_Y = 12;
      
      // Find the longest line for width calculation
      const maxLineLength = Math.max(...lines.map(line => line.length));
      const tooltipWidth = Math.min(maxLineLength * CHAR_WIDTH + PADDING_X * 2, 300);
      const tooltipHeight = lines.length * LINE_HEIGHT + PADDING_Y * 2;

      // Position tooltip with boundary checking
      const OFFSET_X = 12;
      const OFFSET_Y = 15;

      let tooltipX = mouseX + OFFSET_X;
      let tooltipY = mouseY - tooltipHeight / 2;
      let tooltipLeft = false;

      // Adjust if tooltip goes beyond right edge
      if (tooltipX + tooltipWidth > geom.w) {
        tooltipX = mouseX - tooltipWidth + OFFSET_X - 4;
        tooltipLeft = true;
      }

      // Adjust if tooltip goes beyond top edge
      if (tooltipY < 0) {
        tooltipY = mouseY + OFFSET_Y;
      }

      // Adjust if tooltip goes beyond bottom edge
      if (tooltipY + tooltipHeight > geom.h) {
        tooltipY = geom.h - tooltipHeight - 5;
      }

      setTooltip({
        x: tooltipX,
        y: tooltipY,
        lines: lines,
        color: measure.color || "#6565ec",
        left: tooltipLeft
      });
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
      setTooltip(null);
    };

    return (
      <Box 
        position="absolute" 
        style={{ top: geom.y, left: geom.x }}
      >
        <canvas
          ref={initChart}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ 
            border: "1px solid #e2e8f0", 
            display: "block", 
            borderRadius: "12px", 
            cursor: hoveredPoint ? 'pointer' : 'default',
            background: 'white'
          }}
          width={geom.w}
          height={geom.h}
        />

        {tooltip && (
          <Box
            position="absolute"
            left={tooltip.x}
            top={tooltip.y}
            bg="white"
            color="#1a1a1a"
            px={3}
            py={2}
            borderRadius="8px"
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)"
            fontSize="13px"
            fontWeight="500"
            pointerEvents="none"
            zIndex="10"
            maxWidth="300px"
            border="1px solid #e5e7eb"
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(255, 255, 255, 0.97)'
            }}
          >
            {/* Tooltip content with multiple lines */}
            <Box display="flex" flexDirection="column" gap={1}>
              {tooltip.lines.map((line, index) => (
                <Box 
                  key={index}
                  display="flex"
                  alignItems="center"
                  gap={1.5}
                  lineHeight="1.4"
                >
                  {/* Colored bullet for first line, smaller bullets for others */}
                  {index === 0 ? (
                    <Box
                      width="10px"
                      height="10px"
                      borderRadius="50%"
                      bg={tooltip.color}
                      flexShrink={0}
                    />
                  ) : (
                    <Box
                      width="6px"
                      height="6px"
                      borderRadius="50%"
                      bg="#94a3b8"
                      flexShrink={0}
                      marginLeft="2px"
                    />
                  )}
                  <Box>{line}</Box>
                </Box>
              ))}
            </Box>
            
          </Box>
        )}
      </Box>
    );
  }

  function PieChartCanvas({ item, dashboardId, geom, attrs, data }: PieChartCanvasProps) {
    const [tooltip, setTooltip] = useState<{x: number, y: number, text: string} | null>(null);
    const [hoveredPieIndex, setHoveredPieIndex] = useState<{
    pieIndex: number,
    sliceIndex: number
  } | null>(null);
  
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<PieChartItem | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  
    const initChart = useCallback((el: HTMLCanvasElement | null) => {
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;

      ctxRef.current = ctx;
      canvasRef.current = el;
      
      const chart = new PieChartItem(item.item_id, dashboardId, item.display_order, geom, attrs, data, ctxRef.current);
      chartRef.current = chart;
      
      chart.render(null);
    }, [item, dashboardId, geom, attrs, data]);

    useEffect(() => {
      if (ctxRef.current && chartRef.current) {
        chartRef.current.render(hoveredPieIndex);
      }
    }, [hoveredPieIndex]);
  
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !chartRef.current) return;

      const parent = canvasRef.current.parentElement!.getBoundingClientRect();
      const mouseX = e.clientX - parent.left;
      const mouseY = e.clientY - parent.top;

      const indexes = chartRef.current.getSliceAtCursor(mouseX, mouseY);
      setHoveredPieIndex(indexes);

      if (indexes === null) {
        setTooltip(null);
        return;
      }

      // Access the cached slice data
      const cache = (chartRef.current as any)._cache;
      if (!cache || !cache.slices) {
        setTooltip(null);
        return;
      }

      // Find the matching slice from the cache
      const slice = cache.slices.find(
        (s: any) => s.pieIndex === indexes.pieIndex && s.sliceIndex === indexes.sliceIndex
      );

      if (!slice) {
        setTooltip(null);
        return;
      }

      // Build tooltip text
      const pieLabel = slice.pieName;
      const sliceLabel = slice.sliceName;
      const sliceValue = slice.value;

      setTooltip({
        x: mouseX + 3,
        y: mouseY - 28,
        text: `${pieLabel}: ${sliceLabel}: ${toPersianDigits(sliceValue)}`
      });
    };

    // Add mouse leave handler
    const handleMouseLeave = () => {
      setHoveredPieIndex(null);
      setTooltip(null);
    };
  
    return (
      <Box position="absolute" style={{top: geom.y, left: geom.x}}>
        <canvas
          ref={initChart}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ border: "1px solid #e2e8f0", display: "block", borderRadius: "12px"}}
          width={geom.w}
          height={geom.h}
        />
  
        {tooltip && (
          <Box
            position="absolute"
            left={tooltip.x}
            top={tooltip.y}
            bg="white"
            color="black"
            px={2}
            py={1}
            borderRadius="6px"
            borderColor="#6565ec"
            borderWidth="1px"
            fontSize="12px"
            pointerEvents="none"
            whiteSpace="nowrap"
            height="28px"
          >
            {tooltip.text}
          </Box>
        )}
      </Box>
    );
  }

  function BarChartCanvas({ item, dashboardId, geom, attrs, data }: BarChartCanvasProps) {
     const [tooltip, setTooltip] = useState<{ 
      x: number; 
      y: number; 
      lines: string[];
      color: string;
      left: boolean;
    } | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ index: number; measureIndex: number } | number | null>(null);
  
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<BarChartItem | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  
    const initChart = useCallback((el: HTMLCanvasElement | null) => {
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;

      ctxRef.current = ctx;
      canvasRef.current = el;
      
      const chart = new BarChartItem(item.item_id, dashboardId, item.display_order, geom, attrs, data, ctxRef.current);
      chartRef.current = chart;
      
      chart.render(null);
    }, [item, dashboardId, geom, attrs, data]);

    useEffect(() => {
      if (ctxRef.current && chartRef.current) {
        chartRef.current.render(hoveredPoint);
      }
    }, [hoveredPoint]);
  
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !chartRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const point = chartRef.current.getSliceAtCursor(mouseX, mouseY);
      setHoveredPoint(point);

      if (!point) {
        setTooltip(null);
        return;
      }

      // Build multi-line tooltip content
      const xField = attrs.axes.xAxis.fields[0];
      const measure = attrs.axes.yAxis.measures[point.measureIndex];
      const xValue = data[point.index][xField.name];
      const yValue = data[point.index][measure.name];

      const lines = [
        `${xField.label || 'X'}: ${xValue}`,
        `${measure.label || 'Y'}: ${yValue}`
      ];

      // Calculate tooltip dimensions for positioning
      const LINE_HEIGHT = 20;
      const CHAR_WIDTH = 8;
      const PADDING_X = 16;
      const PADDING_Y = 12;
      
      // Find the longest line for width calculation
      const maxLineLength = Math.max(...lines.map(line => line.length));
      const tooltipWidth = Math.min(maxLineLength * CHAR_WIDTH + PADDING_X * 2, 300);
      const tooltipHeight = lines.length * LINE_HEIGHT + PADDING_Y * 2;

      // Position tooltip with boundary checking
      const OFFSET_X = 10;
      const OFFSET_Y = 15;

      let tooltipX = mouseX + OFFSET_X;
      let tooltipY = mouseY - tooltipHeight / 2;
      let tooltipLeft = false;

      // Adjust if tooltip goes beyond right edge
      if (tooltipX + tooltipWidth > geom.w) {
        tooltipX = mouseX - tooltipWidth + OFFSET_X;
        tooltipLeft = true;
      }

      // Adjust if tooltip goes beyond top edge
      if (tooltipY < 0) {
        tooltipY = mouseY + OFFSET_Y;
      }

      // Adjust if tooltip goes beyond bottom edge
      if (tooltipY + tooltipHeight > geom.h) {
        tooltipY = geom.h - tooltipHeight - 5;
      }

      setTooltip({
        x: tooltipX,
        y: tooltipY,
        lines: lines,
        color: measure.color || "#6565ec",
        left: tooltipLeft
      });
    };

    // Add mouse leave handler
    const handleMouseLeave = () => {
      setHoveredPoint(null);
      setTooltip(null);
    };
  
    return (
      <Box 
        position="absolute" 
        style={{ top: geom.y, left: geom.x }}
      >
        <canvas
          ref={initChart}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ 
            border: "1px solid #e2e8f0", 
            display: "block", 
            borderRadius: "12px", 
            cursor: hoveredPoint ? 'pointer' : 'default',
            background: 'white'
          }}
          width={geom.w}
          height={geom.h}
        />

        {tooltip && (
          <Box
            position="absolute"
            left={tooltip.x}
            top={tooltip.y}
            bg="white"
            color="#1a1a1a"
            px={3}
            py={2}
            borderRadius="8px"
            boxShadow="0 4px 12px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)"
            fontSize="13px"
            fontWeight="500"
            pointerEvents="none"
            zIndex="10"
            maxWidth="300px"
            border="1px solid #e5e7eb"
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(255, 255, 255, 0.97)'
            }}
          >
            {/* Tooltip content with multiple lines */}
            <Box display="flex" flexDirection="column" gap={1}>
              {tooltip.lines.map((line, index) => (
                <Box 
                  key={index}
                  display="flex"
                  alignItems="center"
                  gap={1.5}
                  lineHeight="1.4"
                >
                  {/* Colored bullet for first line, smaller bullets for others */}
                  {index === 0 ? (
                    <Box
                      width="10px"
                      height="10px"
                      borderRadius="50%"
                      bg={tooltip.color}
                      flexShrink={0}
                    />
                  ) : (
                    <Box
                      width="6px"
                      height="6px"
                      borderRadius="50%"
                      bg="#94a3b8"
                      flexShrink={0}
                      marginLeft="2px"
                    />
                  )}
                  <Box>{line}</Box>
                </Box>
              ))}
            </Box>
            
          </Box>
        )}
      </Box>
    );
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
