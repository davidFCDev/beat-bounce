/**
 * MusicPlayer — Background music system.
 *
 * Plays two tracks in alternating loop using HTMLAudioElement.
 * Respects platform mute. Starts on first user gesture (autoplay policy).
 */
export class MusicPlayer {
  private tracks: HTMLAudioElement[] = [];
  private currentIndex = 0;
  private muted = false;
  private volume = 0.45;
  private started = false;

  private static readonly URLS: string[] = [
    "https://lqy3lriiybxcejon.public.blob.vercel-storage.com/d5ae2c3d-4476-48d3-b75a-bafac28c3904/floating-debug-screen-mp3cutnet-F4XRzs1FnW-r0yRnlESU7zI6sXaZxO5Q3kS5atKEa.mp3",
    "https://lqy3lriiybxcejon.public.blob.vercel-storage.com/d5ae2c3d-4476-48d3-b75a-bafac28c3904/floating-debug-screen-1-mp3cutnet-6LkZeW8X4f-7hbmSpbHcxmAeVneCHusSBtpGaToUZ.mp3",
  ];

  constructor() {
    // Lazy: don't set audio.src here.
    // Audio elements are created in ensureTracks() on first start().
  }

  /** Try to start playback. Call on user gesture (pointerdown, etc.). */
  start(): void {
    if (this.started || this.muted) return;
    this.started = true;
    this.ensureTracks();
    this.playCurrentTrack();
  }

  /** Create Audio elements on-demand (deferred from constructor). */
  private ensureTracks(): void {
    if (this.tracks.length > 0) return;
    for (const url of MusicPlayer.URLS) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = this.volume;
      audio.addEventListener("ended", () => this.onTrackEnded());
      audio.src = url; // hits HTTP cache from PreloadScene fetch()
      this.tracks.push(audio);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const t of this.tracks) {
      t.volume = muted ? 0 : this.volume;
    }
    if (muted) {
      this.pauseAll();
    } else if (this.started) {
      this.playCurrentTrack();
    }
  }

  destroy(): void {
    for (const t of this.tracks) {
      t.pause();
      t.src = "";
    }
    this.tracks = [];
  }

  /* ── internals ──────────────────────────────────── */

  private playCurrentTrack(): void {
    if (this.tracks.length === 0) return;
    const track = this.tracks[this.currentIndex];
    track.volume = this.muted ? 0 : this.volume;
    track.play().catch(() => {
      // Autoplay blocked — will retry on next user gesture
      this.started = false;
    });
  }

  private onTrackEnded(): void {
    // Advance to next track (wraps around)
    this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
    this.playCurrentTrack();
  }

  private pauseAll(): void {
    for (const t of this.tracks) {
      t.pause();
    }
  }
}
