import { PreloadSceneBase } from "./PreloadSceneBase";

/**
 * PreloadScene — Preloads game assets (music tracks) while showing
 * the boot animation, then transitions to GameScene.
 */
export class PreloadScene extends PreloadSceneBase {
  /** Music URLs to preload */
  private static readonly MUSIC_URLS: string[] = [
    "https://lqy3lriiybxcejon.public.blob.vercel-storage.com/d5ae2c3d-4476-48d3-b75a-bafac28c3904/floating-debug-screen-mp3cutnet-F4XRzs1FnW-r0yRnlESU7zI6sXaZxO5Q3kS5atKEa.mp3",
    "https://lqy3lriiybxcejon.public.blob.vercel-storage.com/d5ae2c3d-4476-48d3-b75a-bafac28c3904/floating-debug-screen-1-mp3cutnet-6LkZeW8X4f-7hbmSpbHcxmAeVneCHusSBtpGaToUZ.mp3",
  ];

  constructor() {
    super("PreloadScene", "GameScene");
  }

  protected loadProjectAssets(): void {
    // Warm the browser HTTP cache with fetch() (no decode).
    // MusicPlayer will later create Audio elements whose requests
    // hit the cache instantly — avoids heavy decode during GameScene.create().
    PreloadScene.MUSIC_URLS.forEach((url) => {
      fetch(url).catch(() => {});
    });
  }
}
