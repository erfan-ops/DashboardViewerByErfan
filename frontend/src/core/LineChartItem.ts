import { DashboardItem } from "./DashboardItem";
import { lightenColor, toPersianDigits, formatWithThousandSeparators, addOpacity } from "./utils";

export interface LineAttributes {
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

export class LineChartItem extends DashboardItem {
  attributes: LineAttributes;
  data: { [key: string]: any }[];
  cache: Array<Array<{ x: number; y: number; measureIndex: number }>> = [];

  constructor(
    id: number,
    dashboardId: number,
    order: number,
    geometry: any,
    attributes: LineAttributes,
    data: { [key: string]: any }[],
    ctx: CanvasRenderingContext2D
  ) {
    super(id, dashboardId, "LIN", order, geometry, ctx);
    this.attributes = attributes;
    this.data = data;
  }

  render(hovered: { index: number; measureIndex: number } | null = null) {
    const { w, h } = this.geometry;
    const a = this.attributes;

    
    const xField = a.axes.xAxis.fields[0]?.name ?? "";
    
    const measures = a.axes.yAxis.measures;
    const count = Math.max(1, this.data.length);
    
    const values = this.data.map(row =>
      measures.map(m => Number(row?.[m.name]) || 0)
    );

    const gridCount = 5;
    
    const labels = this.data.map(row => String(row?.[xField] ?? ""));
    
    const flatValues = values.flat();
    const maxVal = Math.max(1, ...flatValues);
    const minVal = Math.min(0, ...flatValues);
    const minMaxDiff = maxVal - minVal;
    
    const roundPrecision = 10 ** (Math.floor(Math.log10(minMaxDiff)) - 2);
    let scaleMarkersLeftMarginValues: number[] = []
    for (let i = 0; i <= gridCount; i++) {
        scaleMarkersLeftMarginValues.push(this.ctx.measureText(toPersianDigits(formatWithThousandSeparators(Math.round((minVal + minMaxDiff * (1 - i / gridCount)) / roundPrecision) * roundPrecision))).width + 30);
    }

    const scaleMarkersLeftMargin = Math.max(...scaleMarkersLeftMarginValues);

    const marginLeft = scaleMarkersLeftMargin;
    const marginRight = 40;
    const marginTop = 60;
    const marginBottom = 60;

    
    const drawWidth = w - marginLeft - marginRight;
    const drawHeight = h - marginTop - marginBottom;

    const stepX = drawWidth / Math.max(1, count - 1);
    const circleRadius = 4.5;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = a.appearance.backgroundColor;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.font = `bold ${a.appearance.labels.size}px ${a.appearance.labels.font}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    /* ---------- GRID ---------- */
    if (a.appearance.grid.show) {
      this.ctx.fillStyle = a.appearance.labels.color;
      this.ctx.strokeStyle = a.appearance.grid.color;
      this.ctx.lineWidth = 1;

      for (let i = 0; i <= gridCount; i++) {
        const y = marginTop + drawHeight * (i / gridCount);
        const value = Math.round((minVal + minMaxDiff * (1 - i / gridCount)) / roundPrecision) * roundPrecision;

        this.ctx.beginPath();
        this.ctx.moveTo(marginLeft, y);
        this.ctx.lineTo(w - marginRight, y);
        this.ctx.stroke();

        this.ctx.fillText(toPersianDigits(formatWithThousandSeparators(value)), scaleMarkersLeftMargin / 2, y);
      }
    }

    this.cache = [];

    /* ---------- LINES ---------- */
    measures.forEach((measure, mIndex) => {
      const color = measure.color || "#3b82f6";
      const points: { x: number; y: number; measureIndex: number }[] = [];

      // Glow
      this.ctx.fillStyle = lightenColor(color, 0.6);
      for (let i = 0; i < count; i++) {
        const v = values[i][mIndex];
        const x = marginLeft + i * stepX;
        const y = marginTop + drawHeight * (1 - v / maxVal);
        this.ctx.beginPath();
        this.ctx.arc(x, y, circleRadius * 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Line
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const v = values[i][mIndex];
        const x = marginLeft + i * stepX;
        const y = marginTop + drawHeight * (1 - v / maxVal);
        i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        points.push({ x, y, measureIndex: mIndex });
      }
      this.ctx.stroke();

      // Fill
      const gradient = this.ctx.createLinearGradient(0, marginTop, 0, h - marginBottom);

      gradient.addColorStop(0, addOpacity(color, -0.6));
      gradient.addColorStop(1, addOpacity(color, -0.9));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      points.forEach((p, i) => i === 0 ? this.ctx.moveTo(p.x, p.y) : this.ctx.lineTo(p.x, p.y));
      this.ctx.lineTo(points[points.length - 1].x, h - marginBottom);
      this.ctx.lineTo(points[0].x, h - marginBottom);
      this.ctx.closePath();
      this.ctx.fill();

      // Points
      points.forEach((p, i) => {
        const isHovered =
          hovered?.index === i && hovered?.measureIndex === mIndex;

        this.ctx.fillStyle = isHovered ? lightenColor(color, 0.25) : color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, circleRadius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = a.appearance.backgroundColor;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, circleRadius + 1, 0, Math.PI * 2);
        this.ctx.stroke();
      });

      this.cache.push(points);
    });

    /* ---------- X LABELS ---------- */
    this.ctx.fillStyle = a.appearance.labels.color;
    labels.forEach((l, i) => {
      const x = marginLeft + i * stepX;
      this.ctx.fillText(l, x, h - marginBottom / 2);
    });

    /* ---------- TITLE ---------- */
    if (a.title?.text) {
      this.ctx.fillStyle = a.title.color || "#333";
      this.ctx.font = `bold ${a.appearance.labels.size + 2}px ${a.appearance.labels.font}`;

      const y = 28;
      if (a.title.alignment === "left") this.ctx.fillText(a.title.text, 110, y);
      else if (a.title.alignment === "right") this.ctx.fillText(a.title.text, w - 110, y);
      else this.ctx.fillText(a.title.text, w / 2, y);
    }
  }


  getSliceAtCursor(
    mouseX: number,
    mouseY: number
  ): { index: number; measureIndex: number } | null {
    const r2 = 6 * 6;

    for (let m = 0; m < this.cache.length; m++) {
      for (let i = 0; i < this.cache[m].length; i++) {
        const p = this.cache[m][i];
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        if (dx * dx + dy * dy <= r2) {
          return { index: i, measureIndex: p.measureIndex };
        }
      }
    }
    return null;
  }
}