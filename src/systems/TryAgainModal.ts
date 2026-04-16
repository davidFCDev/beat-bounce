/**
 * TryAgainModal — fullscreen canvas overlay shown on death.
 *
 * Two buttons:
 *  - "Try Again" (cyan) — triggers purchase then resumes
 *  - "End Game"  (red)  — ends the run
 *
 * Rendered entirely on the shared CanvasTexture — no DOM elements.
 */

const TAU = Math.PI * 2;

export interface TryAgainModalCallbacks {
  onTryAgain: () => void;
  onEndGame: () => void;
}

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class TryAgainModal {
  private W: number;
  private H: number;
  private callbacks: TryAgainModalCallbacks | null = null;
  private visible = false;
  private animProgress = 0; // 0→1 fade-in
  private pulseTime = 0;

  /* button hit areas (computed once on show) */
  private tryBtn: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };
  private endBtn: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };

  /* loading state while purchase is in progress */
  private loading = false;

  constructor(W: number, H: number) {
    this.W = W;
    this.H = H;
  }

  /* ── lifecycle ──────────────────────────────────── */

  show(callbacks: TryAgainModalCallbacks): void {
    this.callbacks = callbacks;
    this.visible = true;
    this.animProgress = 0;
    this.pulseTime = 0;
    this.loading = false;
    this.computeLayout();
  }

  hide(): void {
    this.visible = false;
    this.callbacks = null;
    this.loading = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setLoading(v: boolean): void {
    this.loading = v;
  }

  /* ── update ─────────────────────────────────────── */

  update(dt: number): void {
    if (!this.visible) return;
    this.animProgress = Math.min(1, this.animProgress + dt * 3.5);
    this.pulseTime += dt;
  }

  /* ── hit test (game-space coords) ───────────────── */

  handlePointer(gx: number, gy: number): "try" | "end" | null {
    if (!this.visible || this.animProgress < 0.6) return null;
    if (this.loading) return null;

    if (this.inside(gx, gy, this.tryBtn)) return "try";
    if (this.inside(gx, gy, this.endBtn)) return "end";
    return null;
  }

  /* ── render ─────────────────────────────────────── */

  render(ctx: CanvasRenderingContext2D, score: number): void {
    if (!this.visible) return;

    const a = this.easeOutCubic(this.animProgress);

    // ── Dimmed backdrop ──
    ctx.save();
    ctx.fillStyle = `rgba(2,2,12,${0.75 * a})`;
    ctx.fillRect(0, 0, this.W, this.H);

    // ── Central panel ──
    const pw = 520;
    const ph = 420;
    const px = (this.W - pw) / 2;
    const py = (this.H - ph) / 2 - 20;
    const r = 28;

    ctx.globalAlpha = a;

    // Panel background
    this.roundRect(ctx, px, py, pw, ph, r);
    const grad = ctx.createLinearGradient(px, py, px, py + ph);
    grad.addColorStop(0, "rgba(15,15,35,0.95)");
    grad.addColorStop(1, "rgba(8,8,20,0.98)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Panel border glow
    const pulse = 0.6 + Math.sin(this.pulseTime * 3) * 0.4;
    ctx.strokeStyle = `rgba(0,255,255,${0.35 * pulse})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Score display ──
    const cx = this.W / 2;
    let ty = py + 60;

    ctx.font = 'bold 28px "Orbitron", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,255,255,0.5)";
    ctx.fillText("YOUR SCORE", cx, ty);

    ty += 60;
    ctx.font = 'bold 72px "Orbitron", sans-serif';
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(score), cx, ty);

    // Small glow behind score number
    ctx.fillStyle = "rgba(0,255,255,0.15)";
    ctx.fillText(String(score), cx, ty);

    // ── Buttons ──
    ty += 70;
    this.renderButton(
      ctx,
      this.tryBtn,
      this.loading ? "BUYING..." : "TRY AGAIN",
      "#00FFFF",
      "rgba(0,255,255,0.12)",
      pulse,
    );
    this.renderButton(
      ctx,
      this.endBtn,
      "END GAME",
      "#FF0044",
      "rgba(255,0,68,0.10)",
      pulse,
    );

    ctx.restore();
  }

  /* ── private helpers ────────────────────────────── */

  private computeLayout(): void {
    const pw = 520;
    const ph = 420;
    const px = (this.W - pw) / 2;
    const py = (this.H - ph) / 2 - 20;

    const btnW = 400;
    const btnH = 72;
    const btnX = (this.W - btnW) / 2;

    this.tryBtn = { x: btnX, y: py + ph - 200, w: btnW, h: btnH };
    this.endBtn = { x: btnX, y: py + ph - 110, w: btnW, h: btnH };
  }

  private renderButton(
    ctx: CanvasRenderingContext2D,
    btn: ButtonRect,
    label: string,
    color: string,
    bgColor: string,
    pulse: number,
  ): void {
    const r = 16;

    // Button fill
    this.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, r);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha =
      this.easeOutCubic(this.animProgress) * (0.6 + pulse * 0.4);
    ctx.stroke();
    ctx.globalAlpha = this.easeOutCubic(this.animProgress);

    // Label
    ctx.font = 'bold 30px "Orbitron", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  private inside(gx: number, gy: number, btn: ButtonRect): boolean {
    return (
      gx >= btn.x && gx <= btn.x + btn.w && gy >= btn.y && gy <= btn.y + btn.h
    );
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}
