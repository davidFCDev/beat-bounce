import GameSettings from "../config/GameSettings";
import { Orb } from "../objects/Orb";
import { BackgroundRenderer } from "../systems/BackgroundRenderer";
import { BumperManager } from "../systems/BumperManager";
import { MusicPlayer } from "../systems/MusicPlayer";
import { NoteManager } from "../systems/NoteManager";
import { ParticleManager } from "../systems/ParticleManager";
import { SpikeManager } from "../systems/SpikeManager";
import { SynthAudioSystem } from "../systems/SynthAudioSystem";

/**
 * Beat Bounce — main game scene.
 *
 * The orb bounces horizontally between walls (like flappy bird sideways).
 * Gravity pulls it down gently; tap to jump upward.
 * Avoid spikes on the walls and bottom.
 *
 * Renders to a CanvasTexture for full Canvas 2D effects (shadow, alpha).
 */
export class GameScene extends Phaser.Scene {
  /* ── canvas rendering ──────────────────────────── */
  private canvasTexture!: Phaser.Textures.CanvasTexture;
  private ctx!: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;

  /* ── game state ────────────────────────────────── */
  // "waiting" = before startGame(); "countdown" = 3-2-1; "playing" = active; "dead" = game over
  private gameState: "waiting" | "countdown" | "playing" | "dead" = "waiting";
  private score = 0;
  private highScore = 0;
  private pulsePhase = 0;
  private freezeTimer = 0;
  private isMuted = false;
  private started = false; // guard to prevent double-start

  /* ── countdown ─────────────────────────────────── */
  private countdownTimer = 0;
  private countdownNumber = 3;
  private countdownScale = 1;

  /* ── objects & systems ─────────────────────────── */
  private orb!: Orb;
  private spikes!: SpikeManager;
  private notes!: NoteManager;
  private particles!: ParticleManager;
  private bgRenderer!: BackgroundRenderer;
  private synth!: SynthAudioSystem;
  private music!: MusicPlayer;
  private bumpers!: BumperManager;

  constructor() {
    super({ key: "GameScene" });
  }

  /* ══════════════════════════════════════════════════
     PHASER LIFECYCLE
     ══════════════════════════════════════════════════ */

  create(): void {
    this.W = Number(this.game.config.width);
    this.H = Number(this.game.config.height);

    // CanvasTexture for all custom rendering
    this.canvasTexture = this.textures.createCanvas(
      "gameCanvas",
      this.W,
      this.H,
    )!;
    this.ctx = this.canvasTexture.getContext();
    this.add.image(this.W / 2, this.H / 2, "gameCanvas");

    // Systems
    this.orb = new Orb(this.W / 2, this.H / 2);
    this.spikes = new SpikeManager(this.W, this.H);
    this.notes = new NoteManager(this.W, this.H);
    this.particles = new ParticleManager(this.W, this.H);
    this.bgRenderer = new BackgroundRenderer(this.W, this.H);
    this.bgRenderer.init();
    this.synth = new SynthAudioSystem();
    this.synth.init(); // Pre-build audio graph + reverb IR now (avoids stutter on first note)
    this.music = new MusicPlayer();
    this.bumpers = new BumperManager(this.W, this.H);

    // Input
    this.input.on("pointerdown", () => this.handleInput());
    if (this.input.keyboard) {
      this.input.keyboard.on("keydown-SPACE", () => this.handleInput());
      this.input.keyboard.on("keydown-UP", () => this.handleInput());
      this.input.keyboard.on("keydown-W", () => this.handleInput());
    }

    // Start game SYNCHRONOUSLY — no dependency on async SDK
    this.startGame();

    // SDK setup in background (listeners, saved state)
    this.initializeSDK();
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.11);

    if (this.gameState === "countdown") {
      this.tickCountdown(dt);
    } else if (this.gameState === "playing") {
      this.tickPlaying(dt);
    }

    // Always render (background + fading particles even when dead/waiting)
    this.renderFrame();
  }

  /* ══════════════════════════════════════════════════
     SDK
     ══════════════════════════════════════════════════ */

  private async initializeSDK(): Promise<void> {
    const sdk = (window as any).RemixSDK || (window as any).FarcadeSDK;
    if (!sdk) return;

    try {
      await sdk.ready();

      // Load persisted high score from gameState
      const gs = sdk.gameState;
      if (gs?.highScore != null && typeof gs.highScore === "number") {
        this.highScore = gs.highScore;
      }

      // Platform listeners (required for v1 validation)
      sdk.onPlayAgain(() => this.startGame());
      sdk.onToggleMute((d: { isMuted: boolean }) => {
        this.isMuted = d.isMuted;
        this.synth.setMuted(d.isMuted);
        this.music.setMuted(d.isMuted);
      });
    } catch (e) {
      console.warn("[BeatBounce] SDK error, continuing standalone", e);
    }
  }

  private saveHighScore(): void {
    const sdk = (window as any).RemixSDK || (window as any).FarcadeSDK;
    if (!sdk?.singlePlayer?.actions?.saveGameState) return;
    sdk.singlePlayer.actions.saveGameState({
      gameState: { highScore: this.highScore },
    });
  }

  /* ══════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════ */

  private startGame(): void {
    this.score = 0;
    this.freezeTimer = 0;
    this.pulsePhase = 0;

    // Reset orb — center of screen, STOPPED during countdown
    this.orb.reset(this.W / 2, this.H / 2, 0);
    this.orb.vy = 0;

    // Reset systems
    this.spikes.currentSpikeCount = 1;
    this.spikes.generateAll();
    this.particles.clearAll();
    this.bumpers.generate(0); // no bumpers at start
    this.notes.spawn(this.spikes.leftSpikes, this.spikes.rightSpikes);

    // Start countdown
    this.gameState = "countdown";
    this.countdownTimer = 0;
    this.countdownNumber = 3;
    this.countdownScale = 1;
    this.started = true;
  }

  /** Called when countdown finishes — actually launches gameplay. */
  private launchPlay(): void {
    this.gameState = "playing";
    const speed = GameSettings.physics.startingSpeed;
    this.orb.vx = speed;
  }

  /* ══════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════ */

  private handleInput(): void {
    // Start music on first user gesture (autoplay policy)
    this.music.start();
    if (this.gameState === "playing") {
      this.orb.jump();
    }
    // Input blocked during countdown — no jumping allowed
  }

  /* ══════════════════════════════════════════════════
     GAME TICK
     ══════════════════════════════════════════════════ */

  /* ── countdown tick ─────────────────────────────── */

  private tickCountdown(dt: number): void {
    this.countdownTimer += dt;
    // Each number lasts 0.8s
    const STEP = 0.8;
    // Scale: starts big (1.4) and shrinks to 0.6 over the step
    const progress = Math.min(this.countdownTimer / STEP, 1);
    this.countdownScale = 1.4 - progress * 0.8;

    if (this.countdownTimer >= STEP) {
      this.countdownTimer -= STEP;
      this.countdownNumber--;
      this.countdownScale = 1.4;
      if (this.countdownNumber <= 0) {
        this.launchPlay();
      }
    }

    // Keep visuals alive during countdown
    this.bgRenderer.update(dt, 0);
    this.orb.updateVisuals(dt);
  }

  private tickPlaying(dt: number): void {
    // Freeze frame (tiny pause on wall bounce for juice)
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      this.tickVisuals(dt);
      return;
    }

    // ── Orb physics ──
    this.orb.updatePhysics(dt);

    const ww = GameSettings.wall.width;
    const r = GameSettings.orb.radius;

    // ── Horizontal wall bounce ──
    if (this.orb.x - r <= ww) {
      this.orb.x = ww + r;
      this.orb.vx = Math.abs(this.orb.vx);
      this.onWallBounce("left");
    } else if (this.orb.x + r >= this.W - ww) {
      this.orb.x = this.W - ww - r;
      this.orb.vx = -Math.abs(this.orb.vx);
      this.onWallBounce("right");
    }

    // ── Spike collision → death ──
    if (this.spikes.checkCollision(this.orb.x, this.orb.y)) {
      this.onDeath();
      return;
    }

    // ── Barrier collision → horizontal bounce ──
    if (this.bumpers.barriers.length > 0) {
      const hitBarrier = this.bumpers.checkCollision(
        this.orb.x,
        this.orb.y,
        GameSettings.orb.radius,
      );
      if (hitBarrier) {
        // Simple horizontal reversal (like a wall bounce)
        this.orb.vx = -this.orb.vx;
        // Push orb outside barrier
        const halfW = GameSettings.bumper.barrierWidth / 2;
        if (this.orb.x < hitBarrier.x) {
          this.orb.x = hitBarrier.x - halfW - GameSettings.orb.radius - 1;
        } else {
          this.orb.x = hitBarrier.x + halfW + GameSettings.orb.radius + 1;
        }
        this.orb.triggerBounceSquash();
        this.particles.createBounce(
          hitBarrier.x,
          hitBarrier.y,
          this.orb.vx > 0 ? "right" : "left",
        );
        this.pulsePhase = Math.max(this.pulsePhase, 0.5);

        const sdk = (window as any).RemixSDK || (window as any).FarcadeSDK;
        if (sdk?.hapticFeedback) sdk.hapticFeedback();
      }
    }

    // ── Keep inside vertical bounds ──
    if (this.orb.y < r) {
      this.orb.y = r;
      this.orb.vy = Math.abs(this.orb.vy) * 0.5;
    }

    // ── Update everything ──
    this.tickVisuals(dt);
    this.notes.update(dt);

    // ── Note collection ──
    const note = this.notes.checkCollection(this.orb.x, this.orb.y);
    if (note) {
      this.particles.createNoteCollect(note.x, note.y);
      this.particles.createSpeakerWave();
      this.synth.playNoteCollect();
      this.orb.triggerCollectFlash();
      this.score += 1;
      this.spikes.updateDifficulty(this.score);

      const sdk = (window as any).RemixSDK || (window as any).FarcadeSDK;
      if (sdk?.hapticFeedback) sdk.hapticFeedback();

      this.time.delayedCall(300, () => {
        if (this.gameState === "playing") {
          this.notes.spawn(this.spikes.leftSpikes, this.spikes.rightSpikes);
        }
      });
    }
  }

  private tickVisuals(dt: number): void {
    this.orb.updateVisuals(dt);
    this.pulsePhase *= Math.pow(0.95, dt * 60);
    this.particles.update(dt);
    this.particles.updateTrail(
      dt,
      this.orb.x,
      this.orb.y,
      this.gameState === "playing",
      this.freezeTimer > 0,
    );
    this.particles.updateSpeakerWaves(dt);
    this.spikes.updateBottomAnimation(dt, this.pulsePhase);
    this.bgRenderer.update(dt, this.pulsePhase);
    this.bumpers.update(dt);
  }

  /* ── wall bounce ────────────────────────────────── */

  private onWallBounce(side: "left" | "right"): void {
    this.freezeTimer = GameSettings.visual.freezeFrameDuration;
    this.orb.triggerBounceSquash();

    const bx =
      side === "left"
        ? GameSettings.wall.width
        : this.W - GameSettings.wall.width;
    this.particles.createBounce(bx, this.orb.y, side);
    this.pulsePhase = 1;

    this.spikes.regenerateOppositeWall(side, this.orb.y);

    // Barriers — once active, ALWAYS present. Random 1 or 2.
    const bCfg = GameSettings.bumper;
    if (this.score >= bCfg.scoreThreshold) {
      let bCount: number;
      if (this.score < bCfg.doubleScore) {
        bCount = 1;
      } else {
        bCount = Math.random() < bCfg.doubleChance ? 2 : 1;
      }
      this.bumpers.generate(bCount, this.score);
    }
  }

  /* ── death ──────────────────────────────────────── */

  private onDeath(): void {
    this.gameState = "dead";
    this.orb.stop();
    this.freezeTimer = 0;
    this.particles.createDeath(this.orb.x, this.orb.y);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }

    const sdk = (window as any).RemixSDK || (window as any).FarcadeSDK;
    if (sdk?.singlePlayer?.actions?.gameOver) {
      sdk.singlePlayer.actions.gameOver({ score: this.score });
    }
  }

  /* ══════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════ */

  private renderFrame(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.bgRenderer.render(ctx, this.pulsePhase);
    this.particles.renderSpeakerWaves(ctx);
    this.spikes.renderWalls(ctx);
    this.spikes.renderSpikes(ctx);
    this.spikes.renderBottomBars(ctx);
    this.bumpers.render(ctx);
    this.particles.renderTrail(ctx);
    this.particles.renderParticles(ctx);
    this.notes.render(ctx);

    if (this.gameState !== "dead") {
      this.orb.render(ctx);
    }

    this.renderHUD(ctx);

    // Countdown overlay
    if (this.gameState === "countdown") {
      this.renderCountdown(ctx);
    }

    this.canvasTexture.refresh();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const safeY = GameSettings.safeArea.top;
    const cx = this.W / 2;
    ctx.save();

    // Score — layered glow (no shadowBlur)
    ctx.font = 'bold 72px "Orbitron", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,255,255,0.25)";
    ctx.fillText(String(this.score), cx, safeY + 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(this.score), cx, safeY + 10);

    ctx.restore();
  }

  private renderCountdown(ctx: CanvasRenderingContext2D): void {
    const cx = this.W / 2;
    const cy = this.H / 2;
    const label =
      this.countdownNumber > 0 ? String(this.countdownNumber) : "GO!";
    const s = this.countdownScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 140px "Orbitron", sans-serif';

    // Alpha: fade out near end of each step
    const alpha = Math.min(1, this.countdownScale / 0.8);

    // Glow layer
    ctx.fillStyle = `rgba(0,255,255,${alpha * 0.3})`;
    ctx.fillText(label, 0, 0);
    // White text
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}
