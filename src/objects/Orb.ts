import GameSettings from "../config/GameSettings";

const TAU = Math.PI * 2;

/**
 * The player orb – state, physics and rendering.
 *
 * Clean, round cyberpunk sphere:
 *  - 2-layer soft glow (no shadowBlur)
 *  - Radial-gradient body
 *  - Bright core
 *  - Collect flash
 */
export class Orb {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  scaleX = 1;
  scaleY = 1;
  targetScaleX = 1;
  targetScaleY = 1;

  private time = 0;
  private collectFlash = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /* ── lifecycle ──────────────────────────────────── */

  reset(x: number, y: number, speed: number): void {
    this.x = x;
    this.y = y;
    this.vx = speed;
    this.vy = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
    this.time = 0;
    this.collectFlash = 0;
  }

  stop(): void {
    this.vx = 0;
    this.vy = 0;
  }

  /* ── actions ────────────────────────────────────── */

  jump(): void {
    this.vy = -GameSettings.physics.jumpPower;
    this.scaleX = 1.15;
    this.scaleY = 0.85;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
  }

  triggerBounceSquash(): void {
    this.scaleX = 0.7;
    this.scaleY = 1.3;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
  }

  triggerCollectFlash(): void {
    this.collectFlash = 1;
  }

  /* ── update ─────────────────────────────────────── */

  updatePhysics(dt: number): void {
    const { gravity, maxFallSpeed } = GameSettings.physics;
    this.vy += gravity * dt;
    this.vy = Math.min(this.vy, maxFallSpeed);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  updateVisuals(dt: number): void {
    this.time += dt;
    this.scaleX += (this.targetScaleX - this.scaleX) * 10 * dt;
    this.scaleY += (this.targetScaleY - this.scaleY) * 10 * dt;
    this.collectFlash *= Math.pow(0.04, dt);
  }

  /* ── render ─────────────────────────────────────── */

  render(ctx: CanvasRenderingContext2D): void {
    const { radius } = GameSettings.orb;
    const t = this.time;

    // Gentle breathing
    const breath = 1 + Math.sin(t * 2.5) * 0.04;
    const bodyR = radius * breath;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scaleX, this.scaleY);

    // ── 1. Outer glow (2 soft layers, no shadowBlur) ──
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 2, 0, TAU);
    ctx.fillStyle = "rgba(0,255,255,0.04)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 1.4, 0, TAU);
    ctx.fillStyle = "rgba(0,255,255,0.10)";
    ctx.fill();

    // ── 2. Main body — single radial gradient ──
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyR);
    grad.addColorStop(0, "rgba(220,255,255,0.95)");
    grad.addColorStop(0.35, "rgba(0,255,255,0.9)");
    grad.addColorStop(0.75, "rgba(0,200,220,0.7)");
    grad.addColorStop(1, "rgba(0,150,180,0.0)");
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();

    // ── 3. Inner core ──
    ctx.beginPath();
    ctx.arc(0, 0, bodyR * 0.28, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    // ── 4. Collect flash ──
    if (this.collectFlash > 0.02) {
      ctx.beginPath();
      ctx.arc(0, 0, bodyR * 1.5, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${this.collectFlash * 0.3})`;
      ctx.fill();
    }

    ctx.restore();
  }
}
