# PWA Structure, Low-Resource Strategy, and Browser Compatibility

## 1) PWA Structure
- `app/layout.tsx`: registers manifest + theme + base shell
- `public/manifest.webmanifest`: installable app metadata
- service worker:
  - cache static shell/assets
  - network-first for API
  - no background screen capture behavior
- offline UX:
  - allow viewing prior session history cache
  - queue upload retry when back online

## 2) Low-Resource Optimization
- Sparse capture only (45s active, 300s inactive)
- Downscale frames before storing (e.g., max width 960)
- JPEG/WebP quality tuning (small blobs)
- Encode in Worker to avoid UI blocking
- Batch writes to IndexedDB (reduce transaction overhead)
- Frame dedupe:
  - hash or SSIM-lite threshold
  - skip near-identical frames
- Adaptive safeguards:
  - pause capture on low battery (optional)
  - slow capture if tab hidden and no interaction
  - backpressure when memory high

## 3) CPU/RAM/Bandwidth Budget Controls
- Hard cap max draft frames per session
- Rolling flush of old temporary blobs after checkpoints
- Upload only final MP4 (never raw frame stream)
- Cap target MP4 bitrate/resolution based on device class

## 4) Browser Compatibility Strategy
Tiered support:

### Tier A (full)
- Chromium desktop (Chrome/Edge/Brave): screen share + worker encoding + upload

### Tier B (mostly full)
- Firefox desktop: screen share + sparse capture; encoding path may use ffmpeg.wasm fallback

### Tier C (limited)
- Safari/macOS: validate `getDisplayMedia` constraints and codec support; fallback encoder settings

### Not supported in MVP
- iOS Safari full-screen-share timelapse flow (platform restrictions)

Compatibility approach:
- Runtime feature detection, not UA-only checks
- Capability matrix at startup:
  - screen share support
  - worker support
  - codec/encoder support
  - storage quota availability
- Graceful fallback:
  - disable unsupported options
  - show clear guidance without breaking timer/session metadata
