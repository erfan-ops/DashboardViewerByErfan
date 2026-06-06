import { DashboardItem } from "./DashboardItem";
import { toPersianDigits, formatWithThousandSeparators } from "./utils";


export interface BarAttributes {
  type: 'vertical' | 'horizontal';

  title?: {
    text?: string;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
  };

  axes: {
    xAxis: {
      fields: Array<{
        name: string;
        label?: string;
      }>;
    };

    yAxis: {
      measures: Array<{
        name: string;
        label?: string;
        color?: string;
      }>;
    };
  };

  appearance: {
    backgroundColor: string;

    grid: {
      color: string;
      show: boolean;
    };

    labels: {
      color: string;
      font: string;
      size: number;
    };
  };

  summary: {
    include: boolean;
    sumSuffix?: string;
  };
}

export class BarChartItem extends DashboardItem {
    attributes: BarAttributes;
    data: { [key: string]: any }[] = [];
  
    /**
     * cache: per-bar array of segments
     * each segment: { x0, y0, x1, y1, r, measureIndex }
     */
    cache: Array<Array<{ x0: number; y0: number; x1: number; y1: number; r: number; measureIndex: number; name: string; value: number }>> = [];

    private iconImage = new Image();
    private iconLoaded = false;
    private iconWidth = 75;
    private iconHeight = 75;
  
    constructor(
      id: number,
      dashboardId: number,
      order: number,
      geometry: any,
      attributes: BarAttributes,
      data: { [key: string]: any }[],
      ctx: CanvasRenderingContext2D
    ) {
      super(id, dashboardId, "BAR", order, geometry, ctx);
      this.attributes = attributes;
      this.data = data;

      this.iconImage.crossOrigin = 'anonymous';
      this.iconImage.src = "../../resources/bill.svg"
      this.iconImage.onload = () => {
        this.iconLoaded = true;
        this.render();
      };
    }

  
    /*
     * Main render entry used by external system.
     * IMPORTANT: per user's request, we focus on the 2D fallback render method.
     * hoveredParam may be:
     *  - null
     *  - number (barIndex)  [backwards-compatible-ish]
     *  - { barIndex: number, measureIndex: number } (stacked segment)
     */
    render(hoveredParam: number | { index: number; measureIndex: number } | null = null) {
      // Always use 2D fallback per user instruction (ignore WebGL path)
      const { w, h } = this.geometry ?? { w: 800, h: 600 };
      const a = this.attributes;
      this.cache = [];
      
      // Single x-axis field enforced (per your decision)
      const xField = (a.axes.xAxis.fields && a.axes.xAxis.fields[0])?.name || "";
  
      // Measures (for stacked bars). If none, fallback to a single synthetic measure using first numeric key.
      const measures = (a.axes.yAxis && a.axes.yAxis.measures && a.axes.yAxis.measures.length > 0)
        ? a.axes.yAxis.measures
        : [{ name: Object.keys((this.data || [])[0] || { value: 'value' })[0] || 'value', label: 'value', color: '#3b82f6' }];
  
      // Build per-bar per-measure values
      const allValues: number[][] = (this.data || []).map(row => measures.map(m => Number(row?.[m.name]) || 0));
      const labels: string[] = (this.data || []).map(row => String(row?.[xField] ?? ""));
  
      // Ensure at least one bar to avoid division by zero
      const count = Math.max(1, allValues.length);
  
      // Totals per bar (sum of stacked measures)
      const totals = allValues.map(vals => vals.reduce((s, n) => s + n, 0));
      const maxVal = Math.max(...totals);
      const minVal = Math.min(0, ...totals); // usually 0
      const sumVal = totals.reduce((s, n) => s + n, 0);
      const minMaxDiff = maxVal - minVal;
      const roundPrecision = 10 ** (Math.floor(Math.log10(minMaxDiff)) - 2);

      const gridCount = 5;

      let scaleMarkersLeftMarginValues: number[] = []
      for (let i = 0; i <= gridCount; i++) {
          scaleMarkersLeftMarginValues.push(this.ctx.measureText(toPersianDigits(formatWithThousandSeparators(Math.round((minVal + minMaxDiff * (1 - i / gridCount)) / roundPrecision) * roundPrecision))).width + 30);
      }

      const leftMargin = Math.max(...scaleMarkersLeftMarginValues);

      // Layout and margins
      const margin = 40;
      const marginBottom = measures.length > 1 ? 120 : margin + 10;
      const rightMargin = 40;
      const barAreaX0 = leftMargin + 40;
      const barAreaX1 = w;
      const barAreaY0 = margin + 70;
      const barAreaY1 = h - marginBottom;
      const barAreaWidth = barAreaX1 - barAreaX0;
      const barAreaHeight = barAreaY1 - barAreaY0;
  
      // Layout sizes
      const barWidthRatio = 0.5;
      const slotWidth = barAreaWidth / count;
      const barGap = slotWidth * (1 - barWidthRatio);
      const barThickness = slotWidth * barWidthRatio;
  
      // Colors array per measure (rgba255 for canvas convenience)
      const measureColors255: Array<[number, number, number, number]> = measures.map((m, i) => {
        const c = m.color || this.defaultColorForIndex(i);
        return this.hexToRgba255(c);
      });
  
      // clear background
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.fillStyle = a.appearance?.backgroundColor || "#ffffff";
      this.ctx.fillRect(0, 0, w, h);
  
      // Draw baseline (x-axis)
      this.ctx.strokeStyle = a.appearance.grid.color || "#929292ff";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(leftMargin, barAreaY1);
      this.ctx.lineTo(w - rightMargin, barAreaY1);
      this.ctx.stroke();
  
      // Grid
      if (a.appearance?.grid?.show) {
        const step = barAreaHeight / gridCount;
  
        this.ctx.strokeStyle = a.appearance?.grid?.color || "#e0e0e0";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.font = `bold ${a.appearance?.labels?.size || 12}px ${a.appearance?.labels?.font}, sans-serif`;
  
        for (let i = 1; i <= gridCount; i++) {
          const y = barAreaY1 - i * step;
  
          this.ctx.globalAlpha = 0.6;
          this.ctx.beginPath();
          this.ctx.moveTo(leftMargin, y);
          this.ctx.lineTo(w - rightMargin, y);
          this.ctx.stroke();
          this.ctx.globalAlpha = 1;
  
          const labelValue = Math.round(maxVal * i / gridCount / roundPrecision) * roundPrecision;
          this.ctx.fillStyle = a.appearance?.labels?.color || "#333";
          this.ctx.fillText(toPersianDigits(String(formatWithThousandSeparators(labelValue))), leftMargin / 2, y);
        }
      }
  
      // Draw min value at baseline
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.font = `bold ${a.appearance?.labels?.size || 12}px ${a.appearance?.labels?.font}, sans-serif`;
      this.ctx.fillText(toPersianDigits(String(formatWithThousandSeparators(minVal))), leftMargin / 2, barAreaY1);
  
      // Determine hovered info
      let hoveredBarIndex: number | null = null;
      let hoveredMeasureIndex: number | null = null;
      if (hoveredParam === null) {
        hoveredBarIndex = null;
        hoveredMeasureIndex = null;
      } else if (typeof hoveredParam === "number") {
        hoveredBarIndex = hoveredParam;
        hoveredMeasureIndex = null;
      } else {
        hoveredBarIndex = hoveredParam.index;
        hoveredMeasureIndex = hoveredParam.measureIndex;
      }
  
      // Draw bars (stacked)
      for (let i = 0; i < count; i++) {
        const total = totals[i] || 0;
        const slotX = barAreaX0 + i * (barThickness + barGap);
        let currentTopY = barAreaY1; // start at baseline (y increases downward)
        const segments: Array<{ x0: number; y0: number; x1: number; y1: number; r: number; measureIndex: number; name: string; value: number }> = [];
  
        // If we hover the whole bar, we draw a shadow behind the entire stack
        const isBarHovered = hoveredBarIndex === i;
  
        if (isBarHovered) {
          // Draw whole-stack shadow (slightly offset and blurred-looking)
          const shadowX = slotX;
          const shadowWidth = barThickness;
          const shadowHeight = (total / maxVal) * barAreaHeight;
          const shadowY = barAreaY1 - shadowHeight + 2; // 2px offset down
          this.ctx.fillStyle = `rgba(0,0,0,0.12)`;
          this.drawRoundedRect2D(shadowX, shadowY, shadowWidth, shadowHeight, barThickness / 2);
          this.ctx.fill();
        }
  
        // draw each measure from bottom -> top
        for (let m = 0; m < measures.length; m++) {
          const val = allValues[i]?.[m] || 0;
          const segmentHeight = (val / maxVal) * barAreaHeight;
          const segY = currentTopY - segmentHeight;
          const radius = (m === measures.length - 1) ? (barThickness / 2) : 0; // only topmost has rounded head
          const color255 = measureColors255[m];
  
          // If a segment is hovered, lighten it a bit
          let drawColor = color255;
          if (isBarHovered && hoveredMeasureIndex === null) {
            // entire bar hovered: slightly lighten all segments
            drawColor = this.lightenColor255(drawColor, 0.12);
          }
          if (isBarHovered && hoveredMeasureIndex === m) {
            // specific segment hovered: stronger lighten
            drawColor = this.lightenColor255(drawColor, 0.08);
          }
          if (hoveredMeasureIndex === m && hoveredBarIndex === i) {
            // specific-case: already handled; kept for clarity
            drawColor = this.lightenColor255(drawColor, 0.08);
          }
  
          // Draw segment
          this.ctx.fillStyle = `rgba(${drawColor[0]},${drawColor[1]},${drawColor[2]},${drawColor[3] / 255})`;
          if (radius > 0) {
            // rounded top
            this.drawRoundedRect2D(slotX, segY, barThickness, segmentHeight, radius);
          } else {
            // regular rect
            this.ctx.beginPath();
            this.ctx.rect(slotX, segY, barThickness, segmentHeight);
            this.ctx.closePath();
          }
          this.ctx.fill();

          if (measures.length > 1 && segmentHeight > 24 ) {
            this.ctx.fillStyle = "#ffffffff";
            this.ctx.fillText(toPersianDigits(formatWithThousandSeparators(val)), slotX + barThickness / 2, segY + 20);
          }
  
          // Cache segment bounds for hit testing: x0, y0 (top), x1, y1 (bottom)
          segments.push({
            x0: slotX,
            y0: segY,
            x1: slotX + barThickness,
            y1: currentTopY,
            r: radius,
            measureIndex: m,
            name: labels[i],
            value: val
          });
  
          // move current top upward by this segment's height
          currentTopY = segY;
        }
  
        this.cache.push(segments);
      }
  
      // Draw x-axis labels below bars
      this.ctx.fillStyle = a.appearance?.labels?.color || "#333";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "top";
      this.ctx.font = `bold ${a.appearance?.labels?.size || 12}px ${a.appearance?.labels?.font}, sans-serif`;
      for (let i = 0; i < count; i++) {
        const x = barAreaX0 + i * (barThickness + barGap) + barThickness / 2;
        const y = barAreaY1 + 20;
        this.ctx.fillText(labels[i] || "", x, y);
      }
  
      // Title
      if (a.title?.text) {
        this.ctx.fillStyle = a.title?.color || "#333";
        this.ctx.font = `bold ${((a.appearance?.labels?.size || 12) + 2)}px ${a.appearance?.labels?.font}, sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
  
        let titleX = w / 2;
        if (a.title?.alignment === "right") titleX = w - 150;
        if (a.title?.alignment === "left") titleX = 90;
  
        this.ctx.fillText(a.title.text, titleX, 65);
      }
  
      // Sum display (if enabled)
      if (a.summary?.include) {
        this.ctx.direction = "rtl";
        this.ctx.textAlign = "right";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = "#333";
        this.ctx.font = `bold ${(a.appearance?.labels?.size || 12) + 6}px ${a.appearance?.labels?.font}, sans-serif`;
  
        const suffix = a.summary?.sumSuffix || "";
        const text = `${toPersianDigits(formatWithThousandSeparators(sumVal))} ${suffix}`.trim();
  
        if (a.title?.alignment === "right") {
          this.ctx.fillText(text, w - 98, 35);
        } else if (a.title?.alignment === "left") {
          this.ctx.fillText(text, 90, 35);
        } else {
          this.ctx.fillText(text, w / 2, 35);
        }
      }
  
      // Draw the dashboard icon top-right (non-blocking)
      if (this.iconLoaded) this.ctx.drawImage(this.iconImage, w - this.iconWidth - 10, 10, this.iconWidth, this.iconHeight);
  
      // Draw per-bar total labels above each stack
      this.ctx.textAlign = "center";
      this.ctx.fillStyle = a.appearance?.labels?.color || "#333";
      this.ctx.font = `bold ${(a.appearance?.labels?.size || 12) + 2}px ${a.appearance?.labels?.font}, sans-serif`;
      for (let i = 0; i < this.cache.length; i++) {
        const segments = this.cache[i];
        if (!segments || segments.length === 0) continue;
        // top-most segment top Y is segments[segments.length - 1].y0
        const topSeg = segments[segments.length - 1];
        const cx = (topSeg.x0 + topSeg.x1) / 2;
        const y = topSeg.y0 - 10;
        this.ctx.fillText(toPersianDigits(formatWithThousandSeparators(totals[i] || 0)), cx, y);
      }

      this.ctx.font = `bold 16px ${a.appearance?.labels?.font}, sans-serif`;
      this.ctx.textAlign = "left";

      if (measures.length > 1) {
        for (let m = 0; m < measures.length; m++) {
          let measure = measures[m];
          let x = w/2 - (m * 100);
          let y = h - 40;

          this.ctx.fillStyle = measure.color || "#ccc";
          this.ctx.fillRect(x, y, 20, 20);

          this.ctx.fillStyle = a.appearance?.labels?.color || "#333";
          this.ctx.fillText(measure.label || "unknown", x + 30, y + 10);
        }
      }
    }
  
    /*
     * Hit-test for stacked bars.
     * Returns { barIndex, measureIndex } when cursor is over a stacked segment (or the rounded top),
     * otherwise returns null.
     */
    getSliceAtCursor(mouseX: number, mouseY: number): { index: number; measureIndex: number } | null {
      for (let b = 0; b < this.cache.length; b++) {
        const segments = this.cache[b];
        if (!segments) continue;
  
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s];
          // Rectangle hit
          if (mouseX >= seg.x0 && mouseX <= seg.x1 && mouseY >= seg.y0 && mouseY <= seg.y1) {
            return { index: b, measureIndex: seg.measureIndex };
          }
  
          // If this is the top-most segment and it has rounding, check rounded-top circle region
          if (seg.r > 0 && s === segments.length - 1) {
            const width = seg.x1 - seg.x0;
            const cx = seg.x0 + width / 2;
            const cy = seg.y0 + seg.r; // center of rounded corner
            const dx = cx - mouseX;
            const dy = cy - mouseY;
            if (dx * dx + dy * dy <= seg.r * seg.r) {
              return { index: b, measureIndex: seg.measureIndex };
            }
          }
        }
      }
      return null;
    }
  
    // -------------------- helpers --------------------
  
    private drawRoundedRect2D(x: number, y: number, width: number, height: number, radius: number) {
      if (radius <= 0) {
        this.ctx.beginPath();
        this.ctx.rect(x, y, width, height);
        this.ctx.closePath();
        return;
      }

      const r = Math.min(radius, width / 2, height);

      this.ctx.beginPath();

      this.ctx.moveTo(x, y + height);
      this.ctx.lineTo(x, y + r);
      this.ctx.arcTo(x, y, x + r, y, r);
      this.ctx.lineTo(x + width - r, y);
      this.ctx.arcTo(x + width, y, x + width, y + r, r);
      this.ctx.lineTo(x + width, y + height);
      this.ctx.lineTo(x, y + height);

      this.ctx.closePath();
    }
  
    /*
     * Convert #RRGGBBAA or #RRGGBB to [r,g,b,a] in 0-255 convenient for canvas fillStyle.
     */
    private hexToRgba255(hex: string): [number, number, number, number] {
      const clean = hex.replace("#", "");
      if (clean.length === 8) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        const a = parseInt(clean.slice(6, 8), 16);
        return [r, g, b, a];
      } else if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        return [r, g, b, 255];
      }
      return [0, 0, 0, 0];
    }
  
    /*
     * Lighten an rgba255 color by fraction (0..1)
     */
    private lightenColor255(c: [number, number, number, number], fraction: number): [number, number, number, number] {
      return [
        Math.min(255, Math.round(c[0] + 255 * fraction)),
        Math.min(255, Math.round(c[1] + 255 * fraction)),
        Math.min(255, Math.round(c[2] + 255 * fraction)),
        c[3],
      ];
    }
  
    /*
     * Default color pick for a measure index when no color provided.
     */
    private defaultColorForIndex(i: number): string {
      const palette = [
        "#6565ec", "#ff8c42", "#4caf50", "#e53935", "#00bcd4", "#9c27b0", "#ffeb3b"
      ];
      return palette[i % palette.length] + "ff";
    }
}
