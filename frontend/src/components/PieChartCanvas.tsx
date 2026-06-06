import { useEffect, useState, useCallback, useRef } from 'react'
import { Box } from '@chakra-ui/react'
import { PieChartItem, PieAttributes } from '../core/PieChartItem'
import { toPersianDigits } from '../core/utils'
import { DashboardItemResult } from '../types/dashboard'

interface Props {
  item: DashboardItemResult
  dashboardId: number
  geom: any
  attrs: PieAttributes
  data: Record<string, any>[]
}

export default function PieChartCanvas({ item, dashboardId, geom, attrs, data }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [hoveredPieIndex, setHoveredPieIndex] = useState<{
    pieIndex: number
    sliceIndex: number
  } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<PieChartItem | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const initChart = useCallback((el: HTMLCanvasElement | null) => {
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return

    ctxRef.current = ctx
    canvasRef.current = el

    const chart = new PieChartItem(item.item_id, dashboardId, item.display_order, geom, attrs, data, ctxRef.current)
    chartRef.current = chart
    chart.render(null)
  }, [item, dashboardId, geom, attrs, data])

  useEffect(() => {
    if (ctxRef.current && chartRef.current) {
      chartRef.current.render(hoveredPieIndex)
    }
  }, [hoveredPieIndex])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !chartRef.current) return

    const parent = canvasRef.current.parentElement!.getBoundingClientRect()
    const mouseX = e.clientX - parent.left
    const mouseY = e.clientY - parent.top

    const indexes = chartRef.current.getSliceAtCursor(mouseX, mouseY)
    setHoveredPieIndex(indexes)

    if (indexes === null) {
      setTooltip(null)
      return
    }

    const cache = (chartRef.current as any)._cache
    if (!cache || !cache.slices) {
      setTooltip(null)
      return
    }

    const slice = cache.slices.find(
      (s: any) => s.pieIndex === indexes.pieIndex && s.sliceIndex === indexes.sliceIndex
    )

    if (!slice) {
      setTooltip(null)
      return
    }

    setTooltip({
      x: mouseX + 3,
      y: mouseY - 28,
      text: `${slice.pieName}: ${slice.sliceName}: ${toPersianDigits(slice.value)}`,
    })
  }

  const handleMouseLeave = () => {
    setHoveredPieIndex(null)
    setTooltip(null)
  }

  return (
    <Box position="absolute" style={{ top: geom.y, left: geom.x }}>
      <canvas
        ref={initChart}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ border: '1px solid #e2e8f0', display: 'block', borderRadius: '12px' }}
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
  )
}
