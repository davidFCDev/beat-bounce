/**
 * Game Settings for Beat Bounce
 * Centralized configuration for all tunable game parameters
 */

export const GameSettings = {
  canvas: {
    width: 720,
    height: 1080,
  },

  safeArea: {
    top: 120,
  },

  // ── Orb ──────────────────────────────────────────────
  orb: {
    radius: 35,
    color: "#00FFFF",
    trailLength: 10,
    glowIntensity: 1.0,
  },

  // ── Spikes ───────────────────────────────────────────
  spike: {
    length: 70,
    width: 50,
    color: "#FF0044",
    minSafeGap: 280,
    minSpacing: 180,
  },

  // ── Bottom visualizer bars ───────────────────────────
  bottomBar: {
    height: 60,
    baseWidth: 40,
  },

  // ── Walls ────────────────────────────────────────────
  wall: {
    width: 15,
    color: "#1a1a2e",
  },

  // ── Physics ──────────────────────────────────────────
  physics: {
    startingSpeed: 300,
    gravity: 1000,
    jumpPower: 520,
    maxFallSpeed: 900,
  },

  // ── Visual effects ───────────────────────────────────
  visual: {
    backgroundColor: "#0a0a0a",
    freezeFrameDuration: 0.04,
    screenShakeIntensity: 6,
    particleCountOnBounce: 12,
    pulseIntensity: 0.3,
  },

  // ── Difficulty progression ───────────────────────────
  difficulty: {
    /** Score thresholds: 1→2→3→4 spikes per wall */
    thresholds: [4, 10, 18] as readonly number[],
    maxSpikeCount: 4,
  },

  // ── Vertical barriers ─────────────────────────────────
  bumper: {
    color: "#B026FF",
    /** Score at which barriers first appear (always 1 barrier) */
    scoreThreshold: 8,
    /** Score at which 2-barrier layouts can appear */
    doubleScore: 14,
    /** Chance of picking 2 barriers once doubleScore is reached (0-1) */
    doubleChance: 0.45,
    /** Barrier thickness in px */
    barrierWidth: 18,
    /** Barrier total height in px (at scoreThreshold) */
    barrierHeight: 220,
    /** Extra height per score point above scoreThreshold */
    heightPerScore: 8,
    /** Maximum barrier height in px */
    barrierHeightMax: 420,
    /** Number of equalizer segments per barrier */
    segments: 8,
  },

  // ── Musical notes ────────────────────────────────────
  note: {
    size: 70,
  },

  // ── Cyberpunk palette ────────────────────────────────
  palette: {
    neonPurple: "#B026FF",
    neonYellow: "#FFFF00",
    neonGreen: "#39FF14",
  },
};

/**
 * Calcula dimensiones responsive para fullscreen.
 * Width siempre 720, height se expande para pantallas más altas.
 * 2:3 → 720×1080 | 9:16 → 720×1280 | 9:19.5 → 720×1560
 */
export function getResponsiveDimensions(): { width: number; height: number } {
  const BASE_WIDTH = GameSettings.canvas.width;
  const MIN_HEIGHT = GameSettings.canvas.height;
  const BASE_ASPECT = BASE_WIDTH / MIN_HEIGHT;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (vw <= 0 || vh <= 0) {
    return { width: BASE_WIDTH, height: MIN_HEIGHT };
  }

  const viewportAspect = vw / vh;

  if (viewportAspect >= BASE_ASPECT - 0.035) {
    return { width: BASE_WIDTH, height: MIN_HEIGHT };
  }

  const gameHeight = Math.round(BASE_WIDTH / viewportAspect);
  return { width: BASE_WIDTH, height: gameHeight };
}

export default GameSettings;
