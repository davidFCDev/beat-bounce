/**
 * Global type declarations for externally loaded libraries
 */

// Phaser is loaded globally via CDN
declare const Phaser: typeof import("phaser");

// Remix SDK is loaded globally via CDN
declare global {
  interface Window {
    RemixSDK?: any;
    FarcadeSDK?: any; // backward-compat alias
  }
}

export {};
