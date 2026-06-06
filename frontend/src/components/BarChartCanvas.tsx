import { useEffect, useState, useCallback, useRef } from 'react'
import { Box } from '@chakra-ui/react'
import { BarChartItem, BarAttributes } from '../core/BarChartItem'
import { DashboardItemResult } from '../types/dashboard'

interface Props {
  item: DashboardItemResult
  dashboardId: number
  geom: any
  attrs: BarAttributes
  data: Record<string, any>[]
}

export default function BarChartCanvas({ item, dashboardId, geom, attrs, data }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    lines: string[]
    color: string
    left: boolean
  } | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; measureIndex: number } | number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<BarChartItem | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const initChart = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    ctxRef.current = ctx
    canvasRef.current = el

    const chart = new BarChartItem(item.item_id, dashboardId, item.display_order, geom, attrs, data, ctxRef.current)
    chartRef.current = chart
    chart.render(null)
  }, [item, dashboardId, geom, attrs, data])

  useEffect(() => {
    if (ctxRef.current && chartRef.current) {
      chartRef.current.render(hoveredPoint)
    }
  }, [hoveredPoint])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !chartRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const point = chartRef.current.getSliceAtCursor(mouseX, mouseY)
    setHoveredPoint(point)

    if (!point) {
      setTooltip(null)
      return
    }

    const xField = attrs.axes.xAxis.fields[0]
    const measure = attrs.axes.yAxis.measures[point.measureIndex]
    const xValue = data[point.index][xField.name]
    const yValue = data[point.index][measure.name]

    const lines = [
      `${xField.label || 'X'}: ${xValue}`,
      `${measure.label || 'Y'}: ${yValue}`,
    ]

    const LINE_HEIGHT = 20
    const CHAR_WIDTH = 8
    const PADDING_X = 16
    const PADDING_Y = 12

    const maxLineLength = Math.max(...lines.map(line => line.length))
    const tooltipWidth = Math.min(maxLineLength * CHAR_WIDTH + PADDING_X * 2, 300)
    const tooltipHeight = lines.length * LINE_HEIGHT + PADDING_Y * 2

    const OFFSET_X = 10
    const OFFSET_Y = 15

    let tooltipX = mouseX + OFFSET_X
    let tooltipY = mouseY - tooltipHeight / 2
    let tooltipLeft = false

    if (tooltipX + tooltipWidth > geom.w) {
      tooltipX = mouseX - tooltipWidth + OFFSET_X
      tooltipLeft = true
    }
    if (tooltipY < 0) {
      tooltipY = mouseY + OFFSET_Y
    }
    if (tooltipY + tooltipHeight > geom.h) {
      tooltipY = geom.h - tooltipHeight - 5
    }

    setTooltip({
      x: tooltipX,
      y: tooltipY,
      lines: lines,
      color: measure.color || '#6565ec',
      left: tooltipLeft,
    })
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
    setTooltip(null)
  }

  return (
    <Box position="absolute" style={{ top: geom.y, left: geom.x }}>
      <canvas
        ref={initChart}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          border: '1px solid #e2e8f0',
          display: 'block',
          borderRadius: '12px',
          cursor: hoveredPoint ? 'pointer' : 'default',
          background: 'white',
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
            backgroundColor: 'rgba(255, 255, 255, 0.97)',
          }}
        >
          <Box display="flex" flexDirection="column" gap={1}>
            {tooltip.lines.map((line, index) => (
              <Box key={index} display="flex" alignItems="center" gap={1.5} lineHeight="1.4">
                {index === 0 ? (
                  <Box width="10px" height="10px" borderRadius="50%" bg={tooltip.color} flexShrink={0} />
                ) : (
                  <Box width="6px" height="6px" borderRadius="50%" bg="#94a3b8" flexShrink={0} marginLeft="2px" />
                )}
                <Box>{line}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
