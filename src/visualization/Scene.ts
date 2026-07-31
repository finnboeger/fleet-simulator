import type { CourseGeometry, Point } from '../simulation/types.js';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Scene {
  private canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private _logicalW = 800;
  private _logicalH = 600;
  private _geometry: CourseGeometry | null = null;
  private _ready = false;

  get isReady(): boolean { return this._ready; }
  get transform(): ViewTransform { return this._transform; }
  get ctx(): CanvasRenderingContext2D { return this._ctx; }

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this._ctx = ctx;
    this._ready = true;
  }

  /** Resize the backing pixel buffer; must be called when the container changes size. */
  resize(w: number, h: number): void {
    const dpr = window.devicePixelRatio ?? 1;
    this._logicalW = w;
    this._logicalH = h;
    // Assigning width/height resets all canvas state – re-apply DPR scale after.
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this._ctx.scale(dpr, dpr);
    if (this._geometry) this.fitCourse(this._geometry);
  }

  simToScreen(pt: Point): { x: number; y: number } {
    return {
      x: pt.x * this._transform.scale + this._transform.offsetX,
      y: -pt.y * this._transform.scale + this._transform.offsetY,
    };
  }

  fitCourse(geometry: CourseGeometry): void {
    this._geometry = geometry;
    const pad = 60;
    const w = this._logicalW;
    const h = this._logicalH;

    const beatLen = geometry.windwardMark.y - geometry.leewardGate.y;
    const sideMargin = Math.max(beatLen * 0.55, 200);

    const scale = Math.min(
      (w - 2 * pad) / (sideMargin * 2),
      (h - 2 * pad) / (geometry.windwardMark.y - geometry.startLine.y),
    );

    this._transform = {
      scale,
      offsetX: w / 2,
      offsetY: h - pad + geometry.startLine.y * scale,
    };
  }

  clear(): void {
    const { _ctx: ctx, _logicalW: w, _logicalH: h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, w, h);
  }

  renderCourse(geometry: CourseGeometry): void {
    const { _ctx: ctx } = this;
    const s = (p: Point) => this.simToScreen(p);

    // Faint centreline
    ctx.beginPath();
    ctx.moveTo(s(geometry.windwardMark).x, s(geometry.windwardMark).y);
    ctx.lineTo(s(geometry.startLine).x, s(geometry.startLine).y);
    ctx.strokeStyle = 'rgba(170,170,170,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Start line
    ctx.beginPath();
    ctx.moveTo(s({ x: -150, y: 0 }).x, s({ x: -150, y: 0 }).y);
    ctx.lineTo(s({ x: 150, y: 0 }).x, s({ x: 150, y: 0 }).y);
    ctx.strokeStyle = '#cc2222';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Leeward gate
    const lgY = geometry.leewardGate.y;
    ctx.beginPath();
    ctx.moveTo(s({ x: -80, y: lgY }).x, s({ x: -80, y: lgY }).y);
    ctx.lineTo(s({ x: 80, y: lgY }).x, s({ x: 80, y: lgY }).y);
    ctx.strokeStyle = '#dd6600';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Windward mark
    const wm = s(geometry.windwardMark);
    ctx.beginPath();
    ctx.arc(wm.x, wm.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#cc2222';
    ctx.fill();

    // Labels
    ctx.fillStyle = '#555555';
    ctx.font = '12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('W', wm.x, wm.y - 14);
    const sl = s({ x: 0, y: 0 });
    ctx.fillText('Start', sl.x, sl.y + 18);
  }

  destroy(): void {
    this._ready = false;
  }
}
