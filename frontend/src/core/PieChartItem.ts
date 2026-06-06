import { DashboardItem } from "./DashboardItem";
import { lightenColor, toPersianDigits, formatWithThousandSeparators, addOpacity } from "./utils";

export interface PieAttributes {
  colors: string;
  slice: string;
  measure: string;
  pies: string;
  lineWidth: number;
  radius: number;
  labelColor: string;
  labelFont: string;
  labelFontSize: number;
  title?: string;
  titleColor: string;
  titleAlignment: string;
  backgroundColor: string;
}

export class PieChartItem extends DashboardItem {
  attributes: PieAttributes;
  data: { [key: string]: any }[];
  
  private _cache: {
    pieNames: string[];
    grouped: Record<string, any[]>;
    cols: number;
    rows: number;
    cellW: number;
    cellH: number;
    startX: number;
    startY: number;
    effectiveRadius: number;
    innerRadius: number;
    outerRadius: number;
    legendHeight: number;
    // New: Cached slice data for precise hit detection
    slices: Array<{
      pieIndex: number;
      sliceIndex: number;
      pieName: string;
      sliceName: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      endAngle: number;
      innerRadius: number;
      outerRadius: number;
      value: number;
    }>;
  } | null = null;

  // Shared configuration, not per instance
  static readonly MAX_LEGEND_ROWS = 4;
  static readonly MIN_CELL_WIDTH = 150;
  static readonly CELL_PADDING = 16;
  static readonly MIN_RADIUS = 8;
  static readonly LEGEND_PADDING_X = 12;
  static readonly LEGEND_PADDING_Y = 8;
  static readonly DEFAULT_TOP_PADDING = 110;

  constructor(
    id: number,
    dashboardId: number,
    order: number,
    geometry: any,
    attributes: PieAttributes,
    data: { [key: string]: any }[],
    ctx: CanvasRenderingContext2D
  ) {
    super(id, dashboardId, "LIN", order, geometry, ctx);
    this.attributes = attributes;
    this.data = data;
  }

  /**
   * Render the pies grid + single bottom legend.
   *
   * hoveredIndex supports the following:
   *  - null => no hover
   *  - { pieIndex: number, sliceIndex: number } => highlights a slice in a specific pie
   *  - number => legacy: treated as sliceIndex within the first pie (best-effort)
   */
  render(hoveredIndex: any = null) {
    const { w, h } = this.geometry;
    const a = this.attributes;

    // --- Basic validation ---
    if (!a.pies || !a.slice || !a.measure) {
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.fillStyle = "red";
      this.ctx.fillText("Missing attribute: pies, slice or measure", w / 2, h / 2);
      return;
    }

    // --- Group data by pies column value ---
    const pieKey = a.pies;
    const grouped: Record<string, { row: any; originalIndex: number }[]> = {};
    for (let i = 0; i < this.data.length; i++) {
      const row = this.data[i];
      const key = String(row[pieKey] ?? "UNKNOWN");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ row, originalIndex: i });
    }

    const pieNames = Object.keys(grouped);
    const pieCount = pieNames.length;

    // If no pies found
    if (pieCount === 0) {
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.fillStyle = a.backgroundColor || "#ffffff";
      this.ctx.fillRect(0, 0, w, h);

      this.ctx.fillStyle = "red";
      this.ctx.fillText(`No groups found for pies column: ${pieKey}`, w / 2, h / 2);
      return;
    }

    // --- Build global slice list and color map ---
    const sliceKey = a.slice;
    const colorPalette = (a.colors || "#3b82f6,#ef4444,#10b981,#f59e0b,#8b5cf6,#ec4899")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // Collect unique slice names across all pies
    const sliceSet = new Set<string>();
    for (const groupKey of pieNames) {
      for (const item of grouped[groupKey]) {
        const s = String(item.row[sliceKey] ?? "UNKNOWN");
        sliceSet.add(s);
      }
    }
    const sliceNames = Array.from(sliceSet).sort((a_, b_) =>
      a_.localeCompare(b_)
    );

    // Map slice name -> color (stable ordering from sliceNames)
    const colorMap: Record<string, string> = {};
    for (let i = 0; i < sliceNames.length; i++) {
      colorMap[sliceNames[i]] = colorPalette[i % colorPalette.length];
    }

    // --- Layout: reserve legend height at bottom ---
    // Legend font and spacing
    const legendFontSize = a.labelFontSize || 12;
    const legendItemHeight = Math.max(legendFontSize + 8, 20);
    const maxLegendRows = 4; // Prevent legend from taking whole canvas if too many items
    const approxLegendRows = Math.min(
      maxLegendRows,
      Math.ceil(sliceNames.length / 6)
    );

    // Compute legendHeight dynamically (single row is better if fits)
    const legendHeight = Math.min(
      70,
      Math.max(legendItemHeight * approxLegendRows + 20, 60)
    );

    // Available area for pies
    const availableH = h - legendHeight - PieChartItem.DEFAULT_TOP_PADDING - 40; // extra bottom padding above legend
    const availableW = w - 20; // small horizontal padding

    // --- Determine grid: columns & rows ---
    // Choose columns by trying to form roughly square grid
    let cols = Math.ceil(Math.sqrt(pieCount));
    let rows = Math.ceil(pieCount / cols);

    // If too wide for small canvas, reduce columns
    while (cols > 1 && availableW / cols < 150) {
      cols--;
      rows = Math.ceil(pieCount / cols);
    }

    const cellW = availableW / cols;
    const cellH = availableH / rows;

    // Compute radius per cell with some margins
    const cellPadding = 16;
    const maxCellRadius = Math.min(
      cellW,
      cellH
    ) / 2 - cellPadding;
    // Respect configured radius but do not exceed computed max
    const effectiveRadius = Math.max(8, Math.min(a.radius || 60, maxCellRadius));

    // Precompute some geometry
    const startX = 10 + (w - availableW) / 2; // left padding
    const startY = PieChartItem.DEFAULT_TOP_PADDING;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = a.backgroundColor || "#ffffff";
    this.ctx.fillRect(0, 0, w, h);

    // Setup common font
    this.ctx.textBaseline = "middle";
    this.ctx.font = `${a.labelFontSize || 12}px ${a.labelFont}, sans-serif`;

    // Helper: resolve hovered info
    let hoverPieIndex: number | null = null;
    let hoverSliceIndex: number | null = null;
    if (hoveredIndex && typeof hoveredIndex === "object") {
      hoverPieIndex =
        Number.isFinite(hoveredIndex.pieIndex) ? hoveredIndex.pieIndex : null;
      hoverSliceIndex =
        Number.isFinite(hoveredIndex.sliceIndex) ? hoveredIndex.sliceIndex : null;
    } else if (typeof hoveredIndex === "number") {
      // best-effort: treat as sliceIndex within first pie
      hoverPieIndex = 0;
      hoverSliceIndex = hoveredIndex;
    }

    // Initialize cache with empty slices array
    this._cache = {
      pieNames,
      grouped: Object.fromEntries(
        pieNames.map(name => [name, grouped[name].map(x => x.row)])
      ),
      cols,
      rows,
      cellW,
      cellH,
      startX,
      startY,
      effectiveRadius,
      innerRadius: effectiveRadius,
      outerRadius: effectiveRadius + a.lineWidth,
      legendHeight,
      slices: [] // Will be populated during rendering
    };

    // --- Draw each pie into its cell ---
    for (let p = 0; p < pieNames.length; p++) {
      const pieValue = pieNames[p];
      const group = grouped[pieValue];
      const rowsInGroup = group.map(g => g.row);

      // local values and labels
      const values = rowsInGroup.map(r => Number(r[a.measure]) || 0);
      const labels = rowsInGroup.map(r => String(r[a.slice]));
      const sum = values.reduce((acc, v) => acc + v, 0);
      const count = Math.max(values.length, 1);

      // compute center for this cell
      const col = p % cols;
      const row = Math.floor(p / cols);

      const cellCenterX = startX + col * cellW + cellW / 2;
      const cellCenterY = startY + row * cellH + cellH / 2;

      this.ctx.fillStyle = "#000";
      this.ctx.textAlign = "center";
      this.ctx.font = `bold ${a.labelFontSize + 10}px ${a.labelFont}, sans-serif`;
      this.ctx.fillText(toPersianDigits(formatWithThousandSeparators(sum)), cellCenterX, cellCenterY);

      // If there's a title per whole widget, draw it centered on top (only once)
      if (p === 0 && a.title) {
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = a.titleColor || "#333";
        this.ctx.font = `bold ${a.labelFontSize + 6}px ${a.labelFont}, sans-serif`;
        // If title alignment specified, place accordingly otherwise center
        if (a.titleAlignment === "left") {
          this.ctx.textAlign = "left";
          this.ctx.fillText(a.title, 12, 22);
        } else if (a.titleAlignment === "right") {
          this.ctx.textAlign = "right";
          this.ctx.fillText(a.title, w - 12, 22);
        } else {
          this.ctx.fillText(a.title, w / 2, 22);
        }
        // restore font
        this.ctx.font = `${a.labelFontSize || 12}px ${a.labelFont}, sans-serif`;
      }

      // small guard: if sum is zero, show a placeholder donut
      if (sum <= 0) {
        this.ctx.fillStyle = "#eee";
        this.ctx.beginPath();
        this.ctx.arc(cellCenterX, cellCenterY, effectiveRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = a.labelColor;
        this.ctx.textAlign = "center";
        this.ctx.fillText("No data", cellCenterX, cellCenterY);
        // draw pie label (pie value) on top of the cell
        this.ctx.textAlign = "center";
        this.ctx.font = `bold ${Math.max(12, a.labelFontSize)}px ${a.labelFont}, sans-serif`;
        this.ctx.fillStyle = a.titleColor || "#333";
        this.ctx.fillText(String(pieValue), cellCenterX, startY + row * cellH + 18);
        // restore font
        this.ctx.font = `${a.labelFontSize || 12}px ${a.labelFont}, sans-serif`;
        continue;
      }

      // draw each slice arc
      const PI2 = Math.PI * 2;
      const PIOver2 = Math.PI / 2;
      const helperFactor = sum / PI2;

      let currentAngle = 0;
      this.ctx.font = `${(a.labelFontSize || 12) + 2}px ${a.labelFont}, sans-serif`;
      for (let i = 0; i < count; i++) {
        const value = values[i];
        if (value <= 0) {
          continue;
        }

        const angle = value / helperFactor;
        const start = currentAngle - PIOver2;
        const end = currentAngle + angle - PIOver2;

        const sliceName = labels[i];
        const baseColor = colorMap[sliceName] || colorPalette[0];
        const thinColor = addOpacity(baseColor, -0.4);
        const isHovered =
          hoverPieIndex === p && hoverSliceIndex === i;

        const bigLW = a.lineWidth * 0.82;
        const thinLW = a.lineWidth * 0.18;
        const thinRadius = effectiveRadius + a.lineWidth * 0.08;
        const bigRadius = thinRadius + a.lineWidth / 2;
        const midRadius = effectiveRadius + a.lineWidth / 2;

        // Cache this slice's geometry data
        if (this._cache) {
          this._cache.slices.push({
            pieIndex: p,
            sliceIndex: i,
            pieName: pieValue,
            sliceName: sliceName,
            centerX: cellCenterX,
            centerY: cellCenterY,
            startAngle: start,
            endAngle: end,
            innerRadius: effectiveRadius,
            outerRadius: effectiveRadius + a.lineWidth,
            value: value
          });
        }

        // thin arc
        this.ctx.strokeStyle = thinColor;
        this.ctx.lineWidth = thinLW + 2;
        this.ctx.beginPath();
        this.ctx.arc(cellCenterX, cellCenterY, thinRadius, start, end);
        this.ctx.stroke();

        // big arc
        this.ctx.strokeStyle = isHovered ? lightenColor(baseColor, 0.25) : baseColor;
        this.ctx.lineWidth = isHovered ? bigLW * 1.15 : bigLW;
        this.ctx.beginPath();
        this.ctx.arc(cellCenterX, cellCenterY, isHovered ? bigRadius + bigLW*0.15/2 : bigRadius, start, end);
        this.ctx.stroke();

        // percent label only if large enough
        const percentValue = (value / sum) * 100;
        if (percentValue > 4) {
          const midAngle = start + angle / 2;
          const lx = cellCenterX + Math.cos(midAngle) * midRadius;
          const ly = cellCenterY + Math.sin(midAngle) * midRadius;

          this.ctx.fillStyle = "white";
          this.ctx.textAlign = "center";
          this.ctx.shadowColor = "rgba(0,0,0,0.5)";
          this.ctx.shadowBlur = 4;
          this.ctx.fillText(toPersianDigits(percentValue.toFixed(0)) + "%", lx, ly);
          this.ctx.shadowBlur = 0;
        }

        currentAngle += angle;
      }

      // draw pie label (pie value) on top of the cell
      this.ctx.textAlign = "center";
      this.ctx.font = `bold ${Math.max(12, a.labelFontSize)}px ${a.labelFont}, sans-serif`;
      this.ctx.fillStyle = a.titleColor || "#333";
      this.ctx.fillText(String(pieValue), cellCenterX, startY + row * cellH - 55);

      // restore font
      this.ctx.font = `${a.labelFontSize || 12}px ${a.labelFont}, sans-serif`;
    }

    // --- Draw global legend at bottom (horizontal, wrapped) ---
    const legendYStart = h - legendHeight + 20;
    this.ctx.font = `${legendFontSize}px ${a.labelFont}, sans-serif`;
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";

    const legendPaddingX = 12;
    const legendPaddingY = 8;
    const maxLegendWidth = w - legendPaddingX * 2;

    // We'll render items left to right, wrapping rows if necessary
    const items: { name: string; color: string }[] = sliceNames.map(s => ({
      name: s,
      color: colorMap[s],
    }));

    // compute each item's width (box + spacing + text)
    const boxSize = Math.max(10, legendFontSize - 2);
    const gap = 16; // space between items
    const measuredWidths: number[] = items.map(item => {
      const textWidth = this.ctx.measureText(item.name).width;
      return boxSize + 6 + textWidth + gap;
    });

    // fill rows
    let curX = legendPaddingX;
    let curY = legendYStart;
    let rowHeight = legendItemHeight;
    for (let i = 0; i < items.length; i++) {
      const wItem = measuredWidths[i];

      if (curX + wItem > maxLegendWidth + legendPaddingX) {
        // wrap
        curX = legendPaddingX;
        curY += rowHeight;
      }

      const item = items[i];

      // draw color box
      this.ctx.fillStyle = item.color;
      this.ctx.fillRect(curX, curY, boxSize, boxSize);

      // draw text
      this.ctx.fillStyle = a.labelColor;
      this.ctx.fillText(item.name, curX + boxSize + 6, curY + boxSize / 2);

      curX += wItem;
    }
  }

  /**
   * Identify slice under cursor. Returns { pieIndex, sliceIndex } or null
   * Uses cached slice geometry for precise distance and angle checking
   */
  getSliceAtCursor(mouseX: number, mouseY: number): {
    pieIndex: number,
    sliceIndex: number
  } | null {
    // If no cache, can't detect slices
    if (!this._cache) return null;
    const c = this._cache;

    // Loop through all cached slices and check distance/angle
    for (const slice of c.slices) {
      // Calculate distance from mouse to slice center
      const dx = mouseX - slice.centerX;
      const dy = mouseY - slice.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check if within radial bounds
      if (distance < slice.innerRadius || distance > slice.outerRadius) {
        continue; // Not in this slice's donut region
      }
      
      // Calculate angle relative to slice center
      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI/2) {
        angle += 2*Math.PI;
      }

      if (angle >= slice.startAngle && angle <= slice.endAngle) {
        return { pieIndex: slice.pieIndex, sliceIndex: slice.sliceIndex };
      }
    }

    return null;
  }

}
