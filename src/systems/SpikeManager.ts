import GameSettings from "../config/GameSettings";
import { hexToRgb, NEON_COLORS } from "../utils/drawing";

/* ── Types ──────────────────────────────────────────── */

export interface WallSpike {
  y: number;
  height: number;
}

export interface BottomSpike {
  x: number;
  width: number;
  height: number;
  targetHeight: number;
  baseHeight: number;
  maxHeight: number;
  animPhase: number;
  animSpeed: number; // individual speed for independent motion
  colorIndex: number;
}

/**
 * Manages wall spikes (left / right) and bottom visualiser bars.
 * Handles generation, collision detection, animation and rendering.
 */
export class SpikeManager {
  leftSpikes: WallSpike[] = [];
  rightSpikes: WallSpike[] = [];
  bottomSpikes: BottomSpike[] = [];
  currentSpikeCount = 1;

  /** Previous Y positions per wall — used to force variation on regeneration. */
  private prevLeftYs: number[] = [];
  private prevRightYs: number[] = [];

  private W: number;
  private H: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.W = canvasWidth;
    this.H = canvasHeight;
  }

  /* ── generation ─────────────────────────────────── */

  generateAll(): void {
    this.prevLeftYs = [];
    this.prevRightYs = [];
    this.leftSpikes = this.generateWallSpikes(this.currentSpikeCount);
    this.rightSpikes = this.generateWallSpikes(this.currentSpikeCount);
    this.prevLeftYs = this.leftSpikes.map((s) => s.y);
    this.prevRightYs = this.rightSpikes.map((s) => s.y);
    this.bottomSpikes = this.generateBottomSpikes();
  }

  regenerateOppositeWall(bouncedSide: "left" | "right", orbY?: number): void {
    // Only regenerate the wall the orb is heading TOWARDS (the opposite one).
    // The wall we just bounced off keeps its spikes (player already dodged them).
    if (bouncedSide === "left") {
      this.rightSpikes = this.generateWallSpikes(
        this.currentSpikeCount,
        orbY,
        this.prevRightYs,
      );
      this.prevRightYs = this.rightSpikes.map((s) => s.y);
    } else {
      this.leftSpikes = this.generateWallSpikes(
        this.currentSpikeCount,
        orbY,
        this.prevLeftYs,
      );
      this.prevLeftYs = this.leftSpikes.map((s) => s.y);
    }
  }

  private generateWallSpikes(
    count: number,
    excludeY?: number,
    prevYs?: number[],
  ): WallSpike[] {
    const margin = 150;
    const available = this.H - margin * 2;
    const {
      minSafeGap: baseSafeGap,
      minSpacing: baseSpacing,
      width: spikeWidth,
    } = GameSettings.spike;
    // Scale constraints down for 4 spikes so they still fit with a guaranteed gap
    const minSafeGap = count >= 4 ? 200 : baseSafeGap;
    const minSpacing = count >= 4 ? 120 : baseSpacing;
    // Exclusion zone around the orb so spikes don’t spawn on top of the player
    const excludeHalf = GameSettings.orb.radius * 4;
    // Minimum distance from any previous spike position to force visible variation
    const MIN_SHIFT = 120;
    const spikes: WallSpike[] = [];

    let attempts = 0;
    while (attempts < 150) {
      attempts++;
      spikes.length = 0;
      for (let i = 0; i < count; i++) {
        spikes.push({
          y: margin + Math.random() * available,
          height: spikeWidth,
        });
      }
      spikes.sort((a, b) => a.y - b.y);

      let valid = true;
      let hasLargeGap = false;

      // Check no spike sits inside the orb’s exclusion zone
      if (excludeY !== undefined) {
        for (const s of spikes) {
          if (Math.abs(s.y - excludeY) < excludeHalf) {
            valid = false;
            break;
          }
        }
      }
      // Force noticeable variation from previous spike positions
      if (valid && prevYs && prevYs.length > 0) {
        for (const s of spikes) {
          for (const py of prevYs) {
            if (Math.abs(s.y - py) < MIN_SHIFT) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
      }
      if (valid) {
        for (let i = 1; i < spikes.length; i++) {
          const gap = spikes[i].y - spikes[i - 1].y - spikeWidth;
          if (gap < minSpacing) {
            valid = false;
            break;
          }
          if (gap >= minSafeGap) hasLargeGap = true;
        }
        if (spikes[0].y - spikeWidth / 2 >= minSafeGap) hasLargeGap = true;
        if (
          this.H - (spikes[spikes.length - 1].y + spikeWidth / 2) >=
          minSafeGap
        )
          hasLargeGap = true;
      }

      if (valid && hasLargeGap) return spikes;
    }

    // Fallback – evenly spaced, shifted from previous
    spikes.length = 0;
    const spacing = available / (count + 1);
    const offset = prevYs && prevYs.length > 0 ? spacing * 0.5 : 0;
    for (let i = 0; i < count; i++) {
      spikes.push({
        y: margin + spacing * (i + 1) + offset,
        height: spikeWidth,
      });
    }
    return spikes;
  }

  private generateBottomSpikes(): BottomSpike[] {
    const base = GameSettings.bottomBar.baseWidth;
    const bh = GameSettings.bottomBar.height;
    const num = Math.floor(this.W / base);
    const arr: BottomSpike[] = [];
    for (let i = 0; i < num; i++) {
      arr.push({
        x: i * base + base / 2,
        width: base,
        height: bh,
        targetHeight: bh,
        baseHeight: bh * 0.2,
        maxHeight: bh * 1.6,
        animPhase: Math.random() * Math.PI * 2, // random start = no wave
        animSpeed: 1.8 + Math.random() * 2.4, // each bar its own tempo
        colorIndex: i % 3, // cycle through 3 neon colors
      });
    }
    return arr;
  }

  /* ── difficulty ─────────────────────────────────── */

  updateDifficulty(score: number): void {
    const t = GameSettings.difficulty.thresholds;
    if (score < t[0]) this.currentSpikeCount = 1;
    else if (score < t[1]) this.currentSpikeCount = 2;
    else if (score < t[2]) this.currentSpikeCount = 3;
    else this.currentSpikeCount = GameSettings.difficulty.maxSpikeCount;
  }

  /* ── collision ──────────────────────────────────── */

  checkCollision(orbX: number, orbY: number): boolean {
    const r = GameSettings.orb.radius;
    const ww = GameSettings.wall.width;
    const sl = GameSettings.spike.length;

    // Left
    if (orbX - r <= ww + sl) {
      for (const s of this.leftSpikes) {
        if (
          orbY > s.y - s.height / 2 - r * 0.8 &&
          orbY < s.y + s.height / 2 + r * 0.8
        ) {
          if (orbX - r < ww + sl) return true;
        }
      }
    }
    // Right
    if (orbX + r >= this.W - ww - sl) {
      for (const s of this.rightSpikes) {
        if (
          orbY > s.y - s.height / 2 - r * 0.8 &&
          orbY < s.y + s.height / 2 + r * 0.8
        ) {
          if (orbX + r > this.W - ww - sl) return true;
        }
      }
    }
    // Bottom bars
    for (const s of this.bottomSpikes) {
      if (
        orbX > s.x - s.width / 2 - r * 0.8 &&
        orbX < s.x + s.width / 2 + r * 0.8
      ) {
        if (orbY + r > this.H - s.height) return true;
      }
    }
    return false;
  }

  /* ── update ─────────────────────────────────────── */

  updateBottomAnimation(dt: number, pulsePhase: number): void {
    const len = this.bottomSpikes.length;
    for (let i = 0; i < len; i++) {
      const s = this.bottomSpikes[i];
      // Each bar animates at its OWN speed + random phase → no wave pattern
      s.animPhase += dt * s.animSpeed;

      const val = Math.sin(s.animPhase) * 0.5 + 0.5; // 0..1
      s.targetHeight = s.baseHeight + (s.maxHeight - s.baseHeight) * val;

      // Smooth interpolation
      s.height += (s.targetHeight - s.height) * 5 * dt;

      // Pulse boost on wall bounce
      if (pulsePhase > 0.3) {
        s.height = Math.max(s.height, s.maxHeight * (0.5 + pulsePhase * 0.4));
      }
    }
  }

  /* ── render ─────────────────────────────────────── */

  renderWalls(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = GameSettings.wall.color;
    ctx.fillRect(0, 0, GameSettings.wall.width, this.H);
    ctx.fillRect(
      this.W - GameSettings.wall.width,
      0,
      GameSettings.wall.width,
      this.H,
    );
  }

  renderSpikes(ctx: CanvasRenderingContext2D): void {
    const ww = GameSettings.wall.width;
    const sl = GameSettings.spike.length;
    const color = GameSettings.spike.color;

    ctx.fillStyle = color;

    // Left (pointing right)
    for (const s of this.leftSpikes) {
      ctx.beginPath();
      ctx.moveTo(ww, s.y - s.height / 2);
      ctx.lineTo(ww + sl, s.y);
      ctx.lineTo(ww, s.y + s.height / 2);
      ctx.closePath();
      ctx.fill();
    }
    // Right (pointing left)
    for (const s of this.rightSpikes) {
      ctx.beginPath();
      ctx.moveTo(this.W - ww, s.y - s.height / 2);
      ctx.lineTo(this.W - ww - sl, s.y);
      ctx.lineTo(this.W - ww, s.y + s.height / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Cached RGB values for neon colors (avoid re-creating array every frame) */
  private static readonly NEON_RGB = NEON_COLORS.map(hexToRgb);

  renderBottomBars(ctx: CanvasRenderingContext2D): void {
    const neonHex = NEON_COLORS;
    const neonRgb = SpikeManager.NEON_RGB;
    const gap = 3;

    ctx.save();

    // Pass 1 — wide soft glow behind each bar (the "neon tube" aura)
    for (const spike of this.bottomSpikes) {
      const barH = spike.height;
      const barY = this.H - barH;
      const bw = spike.width - gap;
      const bx = spike.x - bw / 2;
      const rgb = neonRgb[spike.colorIndex];

      // Outer glow
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.07)`;
      ctx.fillRect(bx - 6, barY - 6, bw + 12, barH + 6);
      // Inner glow
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.14)`;
      ctx.fillRect(bx - 2, barY - 2, bw + 4, barH + 2);
    }

    // Pass 2 — bar body: semi-transparent fill with bright edges
    for (const spike of this.bottomSpikes) {
      const barH = spike.height;
      const barY = this.H - barH;
      const bw = spike.width - gap;
      const bx = spike.x - bw / 2;
      const ci = spike.colorIndex;
      const rgb = neonRgb[ci];
      const color = neonHex[ci];

      // Bar body — semi-transparent core (neon = not solid)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
      ctx.fillRect(bx, barY, bw, barH);

      // Brighter edges (left + right 2px strips)
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.7)`;
      ctx.fillRect(bx, barY, 2, barH);
      ctx.fillRect(bx + bw - 2, barY, 2, barH);

      // Top cap — brightest, the "glowing tip"
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx, barY, bw, 3);
      ctx.globalAlpha = 1;

      // White hot-spot on top 1px
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(bx + 2, barY, bw - 4, 1);
    }

    ctx.restore();
  }
}
