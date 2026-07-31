import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { CourseGeometry, Point } from '../simulation/types.js';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Scene {
  readonly app: Application;
  readonly envelopeContainer: Container;
  private courseLayer: Container;
  private _transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private _ready = false;

  constructor() {
    this.app = new Application();
    this.envelopeContainer = new Container();
    this.courseLayer = new Container();
  }

  async init(container: HTMLDivElement): Promise<void> {
    await this.app.init({
      background: 0xf0f4f8,
      resizeTo: container,
      antialias: true,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
    });
    container.appendChild(this.app.canvas);
    this.app.stage.addChild(this.envelopeContainer);
    this.app.stage.addChild(this.courseLayer);
    this._ready = true;
  }

  get isReady(): boolean { return this._ready; }
  get transform(): ViewTransform { return this._transform; }

  /** Convert simulation coordinates (Y increases upward) to screen space (Y down). */
  simToScreen(pt: Point): { x: number; y: number } {
    return {
      x: pt.x * this._transform.scale + this._transform.offsetX,
      y: -pt.y * this._transform.scale + this._transform.offsetY,
    };
  }

  /** Compute the transform so the full course fits in the canvas with padding. */
  fitCourse(geometry: CourseGeometry): void {
    const pad = 60;
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    const beatLen = geometry.windwardMark.y - geometry.leewardGate.y;
    const sideMargin = Math.max(beatLen * 0.55, 200);

    const simW = sideMargin * 2;
    const simH = geometry.windwardMark.y - geometry.startLine.y;

    const scale = Math.min((w - 2 * pad) / simW, (h - 2 * pad) / simH);

    this._transform = {
      scale,
      // Center horizontally; the sim x-axis midpoint is 0
      offsetX: w / 2,
      // Bottom of rendered area at (h - pad), Y is flipped
      offsetY: h - pad + geometry.startLine.y * scale,
    };
  }

  renderCourse(geometry: CourseGeometry): void {
    this.courseLayer.removeChildren();
    const g = new Graphics();
    const s = (p: Point) => this.simToScreen(p);

    // Faint centreline
    const top = s(geometry.windwardMark);
    const bot = s(geometry.startLine);
    g.moveTo(top.x, top.y).lineTo(bot.x, bot.y)
      .stroke({ color: 0xbbbbbb, width: 1, alpha: 0.5 });

    // Start line
    g.moveTo(s({ x: -150, y: 0 }).x, s({ x: -150, y: 0 }).y)
      .lineTo(s({ x: 150, y: 0 }).x, s({ x: 150, y: 0 }).y)
      .stroke({ color: 0xcc2222, width: 3 });

    // Leeward gate
    g.moveTo(s({ x: -80, y: geometry.leewardGate.y }).x, s({ x: -80, y: geometry.leewardGate.y }).y)
      .lineTo(s({ x: 80, y: geometry.leewardGate.y }).x, s({ x: 80, y: geometry.leewardGate.y }).y)
      .stroke({ color: 0xdd6600, width: 2 });

    this.courseLayer.addChild(g);

    // Windward mark
    const wm = s(geometry.windwardMark);
    const markG = new Graphics();
    markG.circle(wm.x, wm.y, 8).fill(0xcc2222);
    this.courseLayer.addChild(markG);

    // Labels
    const style = new TextStyle({ fontSize: 12, fill: '#555555' });

    const wmLabel = new Text({ text: 'W', style });
    wmLabel.anchor.set(0.5, 1.8);
    wmLabel.position.set(wm.x, wm.y);
    this.courseLayer.addChild(wmLabel);

    const slPt = s({ x: 0, y: 0 });
    const slLabel = new Text({ text: 'Start', style });
    slLabel.anchor.set(0.5, -0.2);
    slLabel.position.set(slPt.x, slPt.y);
    this.courseLayer.addChild(slLabel);
  }

  onResize(callback: () => void): void {
    this.app.renderer.on('resize', callback);
  }

  destroy(): void {
    this.app.destroy(true);
    this._ready = false;
  }
}
