import GameSettings from "../config/GameSettings";
import { hexToRgb, NEON_COLORS } from "../utils/drawing";

/* ── Types ──────────────────────────────────────────── */

export interface Barrier {
  x: number;
  y: number;
  halfH: number;
  /** Flash intensity 0-1 (decays after hit). */
  flash: number;
  /** Per-segment pulse phases for equalizer animation. */
  segPhases: number[];
}

const TWO_PI = Math.PI * 2;

/**
 * Musical equalizer-style barriers that appear in the centre of the arena.
 * Static barriers — 1 big or 2 separated — randomly cycled each bounce.
 */
export class BumperManager {
  barriers: Barrier[] = [];
  private W: number;
  private H: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.W = canvasWidth;
    this.H = canvasHeight;
  }

  /* ── generation ─────────────────────────────────── */

  generate(count: number, score = 0): void {
    this.barriers = [];
    if (count <= 0) return;

    const cfg = GameSettings.bumper;
    const bh = GameSettings.bottomBar.height;
    const orbR = GameSettings.orb.radius;

    // Height scales with score
    const overThreshold = Math.max(0, score - cfg.scoreThreshold);
    const barrierH = Math.min(
      cfg.barrierHeight + overThreshold * cfg.heightPerScore,
      cfg.barrierHeightMax,
    );
    const halfH = barrierH / 2;
    // Dynamic segment count: scale with height to keep segment proportions
    const segs = Math.max(cfg.segments, Math.round(barrierH / 28));

    const minY = GameSettings.safeArea.top + halfH + 40;
    const maxY = this.H - bh - halfH - 80;
    const cx = this.W / 2;
    const range = maxY - minY;
    // Minimum gap between barriers must always fit the orb comfortably
    const passGap = orbR * 6;

    if (count >= 2) {
      // Two barriers — top half + bottom half with safe passage gap
      const minGap = passGap + barrierH;
      if (range < minGap) {
        // Not enough room for 2 — fall back to 1
        const y = minY + range * 0.2 + Math.random() * range * 0.6;
        this.barriers.push(this.createBarrier(cx, y, halfH, segs));
        return;
      }
      const safeMax1 = Math.min(minY + range * 0.35, maxY - minGap);
      const y1 = minY + Math.random() * Math.max(0, safeMax1 - minY);
      const lowestY2 = y1 + minGap;
      const y2 = lowestY2 + Math.random() * Math.max(0, maxY - lowestY2);

      this.barriers.push(this.createBarrier(cx, y1, halfH, segs));
      this.barriers.push(this.createBarrier(cx, y2, halfH, segs));
    } else {
      // Single barrier — random position in centre area
      const y = minY + range * 0.2 + Math.random() * range * 0.6;
      this.barriers.push(this.createBarrier(cx, y, halfH, segs));
    }
  }

  private createBarrier(
    x: number,
    y: number,
    halfH: number,
    segs: number,
  ): Barrier {
    const segPhases: number[] = [];
    for (let i = 0; i < segs; i++) {
      segPhases.push(Math.random() * TWO_PI);
    }
    return { x, y, halfH, flash: 0, segPhases };
  }

  /* ── collision ──────────────────────────────────── */

  checkCollision(
    orbX: number,
    orbY: number,
    orbRadius: number,
  ): Barrier | null {
    const halfW = GameSettings.bumper.barrierWidth / 2;

    for (const b of this.barriers) {
      const overlapX =
        orbX + orbRadius > b.x - halfW && orbX - orbRadius < b.x + halfW;
      const overlapY =
        orbY + orbRadius > b.y - b.halfH && orbY - orbRadius < b.y + b.halfH;

      if (overlapX && overlapY) {
        b.flash = 1;
        return b;
      }
    }
    return null;
  }

  /* ── update ─────────────────────────────────────── */

  update(dt: number): void {
    for (const b of this.barriers) {
      // Flash decay
      b.flash *= Math.pow(0.02, dt);

      // Segment pulse animation
      for (let i = 0; i < b.segPhases.length; i++) {
        b.segPhases[i] += (3 + i * 0.7) * dt;
      }
    }
  }

  /* ── render ─────────────────────────────────────── */

  render(ctx: CanvasRenderingContext2D): void {
    if (this.barriers.length === 0) return;

    const cfg = GameSettings.bumper;
    const rgb = hexToRgb(cfg.color);
    const halfW = cfg.barrierWidth / 2;
    const segs = cfg.segments;

    for (const b of this.barriers) {
      const fa = b.flash;
      const totalH = b.halfH * 2;
      const segH = totalH / segs;
      const gap = 3; // gap between segments

      // ── 1. Outer glow (soft, large) ──
      const glowPad = 12 + fa * 8;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.06 + fa * 0.12})`;
      ctx.fillRect(
        b.x - halfW - glowPad,
        b.y - b.halfH - glowPad,
        cfg.barrierWidth + glowPad * 2,
        totalH + glowPad * 2,
      );

      // ── 2. Inner glow (tighter) ──
      const innerPad = 5 + fa * 4;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.1 + fa * 0.15})`;
      ctx.fillRect(
        b.x - halfW - innerPad,
        b.y - b.halfH - innerPad,
        cfg.barrierWidth + innerPad * 2,
        totalH + innerPad * 2,
      );

      // ── 3. Equalizer segments ──
      for (let i = 0; i < segs; i++) {
        const segY = b.y - b.halfH + i * segH;
        const pulse = 0.5 + Math.sin(b.segPhases[i]) * 0.5; // 0-1

        // Segment colour: blend from green (top) to purple (bottom)
        // Using the 3 neon colours for variety
        const colorIdx = i % 3;
        const segRgb = hexToRgb(NEON_COLORS[colorIdx]);

        // Brightness: base + pulse + flash
        const brightness = 0.4 + pulse * 0.35 + fa * 0.25;

        // Segment body with width that "breathes" slightly
        const extraW = pulse * 4 + fa * 6;
        const sx = b.x - halfW - extraW / 2;
        const sy = segY + gap / 2;
        const sw = cfg.barrierWidth + extraW;
        const sh = segH - gap;

        ctx.fillStyle = `rgba(${segRgb.r},${segRgb.g},${segRgb.b},${brightness})`;
        ctx.fillRect(sx, sy, sw, sh);

        // Bright edge on top of each segment
        ctx.fillStyle = `rgba(255,255,255,${0.15 + pulse * 0.25 + fa * 0.3})`;
        ctx.fillRect(sx + 2, sy, sw - 4, 2);
      }

      // ── 4. Centre line (like a fader track) ──
      ctx.fillStyle = `rgba(255,255,255,${0.3 + fa * 0.5})`;
      ctx.fillRect(b.x - 1, b.y - b.halfH + 2, 2, totalH - 4);

      // ── 5. Flash overlay ──
      if (fa > 0.05) {
        ctx.fillStyle = `rgba(255,255,255,${fa * 0.25})`;
        ctx.fillRect(
          b.x - halfW - 4,
          b.y - b.halfH - 4,
          cfg.barrierWidth + 8,
          totalH + 8,
        );
      }
    }
  }
}
