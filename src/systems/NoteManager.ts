import GameSettings from "../config/GameSettings";
import { hexToRgb, NEON_COLORS } from "../utils/drawing";
import type { WallSpike } from "./SpikeManager";

/* ── Types ──────────────────────────────────────────── */

export interface Note {
  x: number;
  y: number;
  active: boolean;
  size: number;
  glowPhase: number;
  floatOffset: number;
  colorIndex: number;
}

/**
 * Handles spawning, animation, collection detection and rendering
 * of the collectible musical notes.
 */
export class NoteManager {
  notes: Note[] = [];

  private W: number;
  private H: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.W = canvasWidth;
    this.H = canvasHeight;
  }

  /* ── spawn ──────────────────────────────────────── */

  spawn(leftSpikes: WallSpike[], rightSpikes: WallSpike[]): void {
    this.notes = [];
    const ww = GameSettings.wall.width;
    const sl = GameSettings.spike.length;
    const bh = GameSettings.bottomBar.height;
    const margin = 100;

    const safeL = ww + sl + margin;
    const safeR = this.W - ww - sl - margin;
    const safeT = margin + 100;
    const safeB = this.H - bh - margin - 250;

    let x = 0,
      y = 0,
      safe = false,
      att = 0;

    while (!safe && att < 50) {
      att++;
      x = safeL + Math.random() * (safeR - safeL);
      y = safeT + Math.random() * (safeB - safeT);
      safe = true;

      for (const s of leftSpikes) {
        if (x < safeL + 50 && Math.abs(y - s.y) < 150) {
          safe = false;
          break;
        }
      }
      if (safe) {
        for (const s of rightSpikes) {
          if (x > safeR - 50 && Math.abs(y - s.y) < 150) {
            safe = false;
            break;
          }
        }
      }
    }

    this.notes.push({
      x,
      y,
      active: true,
      size: GameSettings.note.size,
      glowPhase: 0,
      floatOffset: 0,
      colorIndex: Math.floor(Math.random() * 3),
    });
  }

  /* ── update ─────────────────────────────────────── */

  update(dt: number): void {
    for (const n of this.notes) {
      if (!n.active) continue;
      n.glowPhase += dt * 3;
      n.floatOffset += dt * 2;
    }
  }

  /* ── collection ─────────────────────────────────── */

  /** Returns the collected note, or null. */
  checkCollection(orbX: number, orbY: number): Note | null {
    if (this.notes.length === 0) return null;
    const n = this.notes[0];
    if (!n.active) return null;
    const dx = orbX - n.x;
    const dy = orbY - n.y;
    if (Math.sqrt(dx * dx + dy * dy) < GameSettings.orb.radius + n.size * 0.6) {
      n.active = false;
      return n;
    }
    return null;
  }

  /* ── render ─────────────────────────────────────── */

  render(ctx: CanvasRenderingContext2D): void {
    for (const n of this.notes) {
      if (!n.active) continue;
      const floatY = n.y + Math.sin(n.floatOffset) * 10;
      const gp = 0.7 + Math.sin(n.glowPhase) * 0.3;
      const color = NEON_COLORS[n.colorIndex];
      const rgb = hexToRgb(color);

      ctx.save();
      ctx.translate(n.x, floatY);

      // Manual glow — two soft circles (replaces expensive shadowBlur)
      ctx.beginPath();
      ctx.arc(0, 0, n.size * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${gp * 0.08})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, n.size * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${gp * 0.15})`;
      ctx.fill();

      // Outer circle
      ctx.beginPath();
      ctx.arc(0, 0, n.size * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(0, 0, n.size * 0.65, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(255,255,255,${gp * 0.8})`;
      ctx.stroke();

      // Note symbol
      ctx.fillStyle = color;
      ctx.font = "bold 50px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u266A", 0, 0);

      // Bright highlight
      ctx.fillStyle = `rgba(255,255,255,${gp * 0.9})`;
      ctx.fillText("\u266A", 0, 0);

      ctx.restore();
    }
  }
}
