import GameSettings from "../config/GameSettings";
import { hexToRgb, NEON_COLORS } from "../utils/drawing";

/* ── Types ──────────────────────────────────────────── */

interface BgParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  shape: number; // 0 square, 1 triangle, 2 hexagon, 3 diamond, 4 music note
  pulsePhase: number;
  pulseSpeed: number;
  /** Depth layer 0=far (small, slow) 1=near (big, fast) */
  depth: number;
}

interface DiscoLaser {
  angle: number;
  rotationSpeed: number;
  color: string;
  width: number;
  length: number;
  pulsePhase: number;
  pulseSpeed: number;
}

/** Tiny background star/dot for depth */
interface BgStar {
  x: number;
  y: number;
  size: number;
  twinklePhase: number;
  twinkleSpeed: number;
  color: string;
}

const TWO_PI = Math.PI * 2;

/**
 * Renders all background visual effects:
 *  - Solid background + beat pulse
 *  - Starfield for depth
 *  - Perspective neon grid with horizon glow
 *  - Disco laser beams
 *  - Floating geometric particles (shapes + music notes)
 */
export class BackgroundRenderer {
  private bgParticles: BgParticle[] = [];
  private discoLasers: DiscoLaser[] = [];
  private bgStars: BgStar[] = [];
  private gridPulse = 0;
  private time = 0;

  private W: number;
  private H: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.W = canvasWidth;
    this.H = canvasHeight;
  }

  /* ── init ───────────────────────────────────────── */

  init(): void {
    this.initBgStars();
    this.initBgParticles();
    this.initDiscoLasers();
  }

  private initBgStars(): void {
    this.bgStars = [];
    for (let i = 0; i < 25; i++) {
      this.bgStars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H * 0.75, // upper 75% only
        size: 1 + Math.random() * 2.5,
        twinklePhase: Math.random() * TWO_PI,
        twinkleSpeed: 1.5 + Math.random() * 3,
        color: NEON_COLORS[Math.floor(Math.random() * 3)],
      });
    }
  }

  private initBgParticles(): void {
    this.bgParticles = [];
    for (let i = 0; i < 10; i++) {
      const depth =
        i < 4 ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4;
      this.bgParticles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        size: 15 + depth * 45,
        speed: 15 + depth * 40,
        rotation: Math.random() * TWO_PI,
        rotationSpeed: (Math.random() - 0.5) * 0.6,
        color: NEON_COLORS[Math.floor(Math.random() * 3)],
        shape: Math.floor(Math.random() * 5),
        pulsePhase: Math.random() * TWO_PI,
        pulseSpeed: 1.5 + Math.random() * 2.5,
        depth,
      });
    }
  }

  private initDiscoLasers(): void {
    this.discoLasers = [];
    const COUNT = 5;
    for (let i = 0; i < COUNT; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.discoLasers.push({
        angle: (i / COUNT) * TWO_PI + Math.random() * 0.3,
        rotationSpeed: dir * (0.2 + Math.random() * 0.35),
        color: NEON_COLORS[i % 3],
        width: 20 + Math.random() * 25,
        length: this.H * 1.5,
        pulsePhase: Math.random() * TWO_PI,
        pulseSpeed: 1.5 + Math.random() * 2,
      });
    }
  }

  /* ── update ─────────────────────────────────────── */

  update(dt: number, pulsePhase: number): void {
    this.time += dt;

    // Stars twinkle
    for (const s of this.bgStars) {
      s.twinklePhase += s.twinkleSpeed * dt;
    }

    // Floating particles
    for (const p of this.bgParticles) {
      p.y += p.speed * dt;
      p.rotation += p.rotationSpeed * dt;
      p.pulsePhase += p.pulseSpeed * dt;
      if (p.y > this.H + p.size) {
        p.y = -p.size;
        p.x = Math.random() * this.W;
      }
    }

    // Grid pulse
    this.gridPulse = pulsePhase > 0.5 ? pulsePhase : this.gridPulse * 0.95;

    // Lasers
    for (const l of this.discoLasers) {
      l.angle += l.rotationSpeed * dt;
      l.pulsePhase += l.pulseSpeed * dt;
    }
  }

  /* ── render (call sub-methods in order) ─────────── */

  render(ctx: CanvasRenderingContext2D, pulsePhase: number): void {
    this.drawBackground(ctx, pulsePhase);
    this.drawStars(ctx);
    this.drawGrid(ctx);
    this.drawDiscoLasers(ctx);
    this.drawBgParticles(ctx);
  }

  /* ── background ─────────────────────────────────── */

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    pulsePhase: number,
  ): void {
    ctx.fillStyle = GameSettings.visual.backgroundColor;
    ctx.fillRect(0, 0, this.W, this.H);

    // Subtle vertical gradient: slightly brighter at bottom (stage floor feel)
    ctx.fillStyle = "rgba(20,10,40,0.15)";
    ctx.fillRect(0, this.H * 0.6, this.W, this.H * 0.4);

    if (pulsePhase > 0.05) {
      const alpha = pulsePhase * GameSettings.visual.pulseIntensity * 0.2;
      const rgb = hexToRgb(GameSettings.orb.color);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  /* ── starfield ──────────────────────────────────── */

  private drawStars(ctx: CanvasRenderingContext2D): void {
    for (const s of this.bgStars) {
      const twinkle = 0.3 + Math.sin(s.twinklePhase) * 0.3;
      const rgb = hexToRgb(s.color);

      // Soft glow behind star
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 3, 0, TWO_PI);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${twinkle * 0.06})`;
      ctx.fill();

      // Star dot
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TWO_PI);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${twinkle * 0.7})`;
      ctx.fill();
    }
  }

  /* ── perspective grid ───────────────────────────── */

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const ci = Math.floor(Date.now() / 3000) % 3;
    const rgb = hexToRgb(NEON_COLORS[ci]);
    const alpha = 0.1 + this.gridPulse * 0.15;

    ctx.save();

    // Horizon glow line
    const horizonY = this.H * 0.68;
    const glowH = 60 + this.gridPulse * 40;
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.04 + this.gridPulse * 0.06})`;
    ctx.fillRect(0, horizonY - glowH / 2, this.W, glowH);

    // Horizon bright line
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.2 + this.gridPulse * 0.2})`;
    ctx.fillRect(0, horizonY - 1, this.W, 2);

    // Grid lines
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
    ctx.lineWidth = 1;

    const centerY = this.H * 0.7;
    const hfc = this.H - centerY;

    // Horizontal grid lines (perspective)
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const y = centerY + hfc * (t * t);
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
    }
    ctx.stroke();

    // Vertical converging lines
    const vanishY = centerY - 200;
    const halfW = this.W / 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const x = (i / 11) * this.W;
      ctx.moveTo(x, this.H);
      ctx.lineTo(halfW + (x - halfW) * 0.3, vanishY);
    }
    ctx.stroke();

    ctx.restore();
  }

  /* ── disco lasers ───────────────────────────────── */

  private drawDiscoLasers(ctx: CanvasRenderingContext2D): void {
    const ox = this.W / 2;
    ctx.save();
    for (const l of this.discoLasers) {
      const pulse = 0.5 + Math.sin(l.pulsePhase) * 0.3;
      const alpha = 0.12 * pulse;

      ctx.save();
      ctx.translate(ox, 0);
      ctx.rotate(l.angle);
      ctx.globalAlpha = alpha;

      // Outer glow (wider, softer)
      ctx.beginPath();
      ctx.moveTo(0, -l.width * 0.9);
      ctx.lineTo(l.length * 0.6, -l.width * 1.8);
      ctx.lineTo(l.length * 0.6, l.width * 1.8);
      ctx.lineTo(0, l.width * 0.9);
      ctx.closePath();
      const rgb = hexToRgb(l.color);
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
      ctx.fill();

      // Beam
      ctx.beginPath();
      ctx.moveTo(0, -l.width / 2);
      ctx.lineTo(l.length, -l.width * 1.5);
      ctx.lineTo(l.length, l.width * 1.5);
      ctx.lineTo(0, l.width / 2);
      ctx.closePath();
      ctx.fillStyle = l.color;
      ctx.fill();

      // Core (bright center line)
      ctx.globalAlpha = alpha * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -l.width * 0.12);
      ctx.lineTo(l.length * 0.7, -l.width * 0.18);
      ctx.lineTo(l.length * 0.7, l.width * 0.18);
      ctx.lineTo(0, l.width * 0.12);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,1)";
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  /* ── floating bg particles ──────────────────────── */

  private drawBgParticles(ctx: CanvasRenderingContext2D): void {
    if (this.bgParticles.length === 0) return;
    ctx.save();

    for (const p of this.bgParticles) {
      const pulse = 0.5 + Math.sin(p.pulsePhase) * 0.5; // 0-1
      const baseAlpha = 0.08 + p.depth * 0.18; // far=dim, near=bright
      const alpha = baseAlpha + pulse * 0.12;
      const size = p.size * (0.85 + pulse * 0.15);
      const rgb = hexToRgb(p.color);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Outer glow
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
      if (p.shape === 4) {
        // Music note glow is circular
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.fillRect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4);
      }

      // Shape fill (translucent)
      ctx.globalAlpha = alpha * 0.4;
      ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`;
      this.drawShape(ctx, p.shape, size);

      // Shape stroke (bright edge)
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5 + p.depth;
      ctx.strokeStyle = p.color;
      this.strokeShape(ctx, p.shape, size);

      ctx.restore();
    }
    ctx.restore();
  }

  /** Fill a geometric shape at origin */
  private drawShape(
    ctx: CanvasRenderingContext2D,
    shape: number,
    size: number,
  ): void {
    const hs = size / 2;
    switch (shape) {
      case 0: // Square
        ctx.fillRect(-hs, -hs, size, size);
        break;
      case 1: // Triangle
        ctx.beginPath();
        ctx.moveTo(0, -hs);
        ctx.lineTo(hs, hs);
        ctx.lineTo(-hs, hs);
        ctx.closePath();
        ctx.fill();
        break;
      case 2: // Hexagon
        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TWO_PI;
          const hx = Math.cos(a) * hs;
          const hy = Math.sin(a) * hs;
          j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 3: // Diamond
        ctx.beginPath();
        ctx.moveTo(0, -hs);
        ctx.lineTo(hs * 0.6, 0);
        ctx.lineTo(0, hs);
        ctx.lineTo(-hs * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case 4: // Music note ♪
        ctx.font = `${size}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u266A", 0, 0);
        break;
    }
  }

  /** Stroke a geometric shape at origin */
  private strokeShape(
    ctx: CanvasRenderingContext2D,
    shape: number,
    size: number,
  ): void {
    const hs = size / 2;
    switch (shape) {
      case 0:
        ctx.strokeRect(-hs, -hs, size, size);
        break;
      case 1:
        ctx.beginPath();
        ctx.moveTo(0, -hs);
        ctx.lineTo(hs, hs);
        ctx.lineTo(-hs, hs);
        ctx.closePath();
        ctx.stroke();
        break;
      case 2:
        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TWO_PI;
          const hx = Math.cos(a) * hs;
          const hy = Math.sin(a) * hs;
          j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case 3:
        ctx.beginPath();
        ctx.moveTo(0, -hs);
        ctx.lineTo(hs * 0.6, 0);
        ctx.lineTo(0, hs);
        ctx.lineTo(-hs * 0.6, 0);
        ctx.closePath();
        ctx.stroke();
        break;
      case 4:
        ctx.font = `${size}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText("\u266A", 0, 0);
        break;
    }
  }
}
