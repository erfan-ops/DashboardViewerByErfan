export interface Geometry {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  
  export abstract class DashboardItem {
    id: number;
    dashboardId: number;
    type: string;
    order: number;
    geometry: Geometry;
    ctx: CanvasRenderingContext2D;
  
    constructor(id: number, dashboardId: number, type: string, order: number, geometry: Geometry, ctx: CanvasRenderingContext2D) {
      this.id = id;
      this.dashboardId = dashboardId;
      this.type = type;
      this.order = order;
      this.geometry = geometry;
      this.ctx = ctx;
    }
  
    abstract render(hoveredIndex: any): void;
  }
  