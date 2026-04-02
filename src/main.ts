const Phaser = (window as any).Phaser;
import { getResponsiveDimensions } from "./config/GameSettings";
import { GameScene } from "./scenes/GameScene";
import { PreloadScene } from "./scenes/PreloadScene";

// Calcula dimensiones responsive (fullscreen dinámico)
const dimensions = getResponsiveDimensions();

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: dimensions.width,
  height: dimensions.height,
  scale: {
    mode: Phaser.Scale.FIT,
    parent: document.body,
    width: dimensions.width,
    height: dimensions.height,
  },
  transparent: true,
  scene: [PreloadScene, GameScene],
  fps: {
    target: 60,
  },
  pixelArt: false,
  antialias: true,
  banner: false,
};

// Create the game instance
const game = new Phaser.Game(config);

// Store globally for performance monitoring and HMR cleanup
(window as any).game = game;

// NO hacer game.scale.resize() en window resize.
// Scale.FIT ya maneja el display scaling.
// getResponsiveDimensions() fija la resolución lógica al inicio.
