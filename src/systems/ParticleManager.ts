import GameSettings from "../config/GameSettings";
import { hexToRgb } from "../utils/drawing";

const TAU = Math.PI * 2;

/* ── Types ──────────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/** A point in the staff trail. */
interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

interface SpeakerWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  speed: number;
  delay: number;
  active: boolean;
  color: string;
  lineWidth: number;
}

/**
 * Manages all particle effects:
 * - Bounce / death / note-collection particles
 * - Musical staff trail (pentagrama)
 * - Speaker waves
 */
export class ParticleManager {
  particles: Particle[] = [];
  private trailPoints: TrailPoint[] = [];
  speakerWaves: SpeakerWave[] = [];

  /** Trail config */
  private readonly TRAIL_MAX_AGE = 0.5;
  private readonly TRAIL_MAX_PTS = 40;
  /** Half-height of the staff around the trail path */
  private readonly STAFF_HALF_H = 22;

  private W: number;
  private H: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.W = canvasWidth;
    this.H = canvasHeight;
  }

  /* ── factories ──────────────────────────────────── */

  createBounce(x: number, y: number, direction: "left" | "right"): void {
    const count = 8; // reduced from 12
    const color = GameSettings.orb.color;
    for (let i = 0; i < count; i++) {
      const angle =
        (direction === "left" ? Math.PI : 0) +
        (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 100 + Math.random() * 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 3,
        color,
      });
    }
  }

  createDeath(x: number, y: number): void {
    for (let i = 0; i < 18; i++) {
      // reduced from 30
      const angle = Math.random() * TAU;
      const speed = 150 + Math.random() * 250;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 4 + Math.random() * 6,
        color:
          Math.random() > 0.5
            ? GameSettings.orb.color
            : GameSettings.spike.color,
      });
    }
  }

  createNoteCollect(x: number, y: number): void {
    const colors = ["#FFD700", "#00FFFF", "#FF00FF", "#00FF88"];
    for (let i = 0; i < 10; i++) {
      // reduced from 15
      const angle = (i / 10) * TAU;
      const speed = 120 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 4,
        color: colors[i & 3],
      });
    }
  }

  createSpeakerWave(): void {
    const cx = this.W / 2;
    const cy = this.H / 2;
    // 2 rings instead of 4 — still looks great, half the draw calls
    this.speakerWaves.push(
      {
        x: cx,
        y: cy,
        radius: 0,
        maxRadius: 380,
        life: 1,
        speed: 300,
        delay: 0,
        active: true,
        color: "rgba(0,255,255,1)",
        lineWidth: 3,
      },
      {
        x: cx,
        y: cy,
        radius: 0,
        maxRadius: 380,
        life: 1,
        speed: 280,
        delay: 0.1,
        active: false,
        color: "rgba(176,38,255,1)",
        lineWidth: 2,
      },
    );
  }

  /* ── update ─────────────────────────────────────── */

  update(dt: number): void {
    const gDt = 400 * dt;
    const lDt = dt * 2;
    let w = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += gDt;
      p.life -= lDt;
      if (p.life > 0) this.particles[w++] = p;
    }
    this.particles.length = w;
  }

  updateTrail(
    dt: number,
    orbX: number,
    orbY: number,
    isPlaying: boolean,
    freezeActive: boolean,
  ): void {
    // Age existing
    for (let i = 0; i < this.trailPoints.length; i++) {
      this.trailPoints[i].age += dt;
    }
    // Remove expired
    let tw = 0;
    for (let i = 0; i < this.trailPoints.length; i++) {
      if (this.trailPoints[i].age < this.TRAIL_MAX_AGE) {
        this.trailPoints[tw++] = this.trailPoints[i];
      }
    }
    this.trailPoints.length = tw;

    // Add new point
    if (isPlaying && !freezeActive) {
      this.trailPoints.push({ x: orbX, y: orbY, age: 0 });
      while (this.trailPoints.length > this.TRAIL_MAX_PTS) {
        this.trailPoints.shift();
      }
    }
  }

  updateSpeakerWaves(dt: number): void {
    let sw = 0;
    for (let i = 0; i < this.speakerWaves.length; i++) {
      const w = this.speakerWaves[i];
      if (!w.active) {
        w.delay -= dt;
        if (w.delay <= 0) w.active = true;
        this.speakerWaves[sw++] = w;
        continue;
      }
      w.radius += w.speed * dt;
      w.life = 1 - w.radius / w.maxRadius;
      if (w.life > 0) this.speakerWaves[sw++] = w;
    }
    this.speakerWaves.length = sw;
  }

  clearAll(): void {
    this.particles = [];
    this.trailPoints = [];
    this.speakerWaves = [];
  }

  /* ── render ─────────────────────────────────────── */

  renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const rgb = hexToRgb(p.color);
      const sz = p.size * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, TAU);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.life})`;
      ctx.fill();
    }
  }

  /**
   * Render a musical staff (pentagrama) that follows the orb's path.
   *
   * 5 lines are drawn parallel to the trajectory, offset perpendicularly.
   * Each line is ONE continuous path → 5 stroke() calls total.
   * Opacity fades with age for a natural dissolve.
   */
  renderTrail(ctx: CanvasRenderingContext2D): void {
    const pts = this.trailPoints;
    if (pts.length < 3) return;

    const maxAge = this.TRAIL_MAX_AGE;
    const halfH = this.STAFF_HALF_H;
    // 5 staff lines: offsets from center path (-1, -0.5, 0, 0.5, 1) × halfH
    const offsets = [-1, -0.5, 0, 0.5, 1];

    ctx.save();

    for (let li = 0; li < 5; li++) {
      const off = offsets[li] * halfH;

      ctx.beginPath();
      let started = false;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const t = 1 - p.age / maxAge; // freshness 0-1
        if (t <= 0) continue;

        // Compute perpendicular direction from segment
        let nx = 0,
          ny = -1; // default: offset upward
        if (i < pts.length - 1) {
          const dx = pts[i + 1].x - p.x;
          const dy = pts[i + 1].y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.5) {
            nx = -dy / len;
            ny = dx / len;
          }
        } else if (i > 0) {
          const dx = p.x - pts[i - 1].x;
          const dy = p.y - pts[i - 1].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.5) {
            nx = -dy / len;
            ny = dx / len;
          }
        }

        const px = p.x + nx * off;
        const py = p.y + ny * off;

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }

      // Staff lines: cyan, fading at old end
      // Use a single alpha for the whole line based on the line position
      // Center line is brightest, outer lines are dimmer
      const lineAlpha = li === 2 ? 0.4 : li === 1 || li === 3 ? 0.3 : 0.2;
      ctx.lineWidth = li === 2 ? 2 : 1.2;
      ctx.strokeStyle = `rgba(0,255,255,${lineAlpha})`;
      ctx.stroke();
    }

    // ── Fade mask: make the old end transparent ──
    // Draw a gradient rectangle over the oldest portion of the trail
    if (pts.length > 2) {
      const oldest = pts[0];
      const mid = pts[Math.min(6, pts.length - 1)];
      const fadeGrad = ctx.createLinearGradient(
        oldest.x,
        oldest.y,
        mid.x,
        mid.y,
      );
      fadeGrad.addColorStop(0, "rgba(10,10,10,0.9)");
      fadeGrad.addColorStop(1, "rgba(10,10,10,0.0)");
      // We draw a thick line along the old part to cover/fade
      ctx.beginPath();
      ctx.moveTo(oldest.x, oldest.y - halfH * 1.5);
      ctx.lineTo(oldest.x, oldest.y + halfH * 1.5);
      ctx.lineTo(mid.x, mid.y + halfH * 1.5);
      ctx.lineTo(mid.x, mid.y - halfH * 1.5);
      ctx.closePath();
      ctx.fillStyle = fadeGrad;
      ctx.fill();
    }

    ctx.restore();
  }

  renderSpeakerWaves(ctx: CanvasRenderingContext2D): void {
    if (this.speakerWaves.length === 0) return;
    ctx.save();
    for (const w of this.speakerWaves) {
      if (!w.active) continue;
      const alpha = w.life * w.life * 0.3;
      if (alpha < 0.01) continue;

      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, TAU);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = w.lineWidth * w.life;
      ctx.strokeStyle = w.color;
      ctx.stroke();
    }
    ctx.restore();
  }
}
