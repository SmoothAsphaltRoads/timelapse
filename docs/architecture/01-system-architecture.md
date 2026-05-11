# Study Verification Platform (MVP) — System Architecture

## 1) Product Scope
A browser-first proof-of-study web app/PWA:
- user shares screen
- app captures sparse screenshots
- timelapse MP4 is generated in-browser
- only final MP4 + session metadata are uploaded

This is **not** continuous surveillance or full video recording.

## 2) High-Level Components

### Client (Next.js App + PWA)
- Auth UI (Supabase Auth)
- Session UI (start/stop timer, share-screen state)
- Capture engine (Canvas + MediaStream frame grabs)
- Activity detector (input + visibility + optional heuristics)
- Frame dedupe (skip near-identical frames)
- Local persistence (IndexedDB for frames/session state)
- Encoder worker (Web Worker + ffmpeg.wasm/WebCodecs fallback)
- Upload client (multipart/tus-style resumable upload to R2 via signed URL)
- Recovery manager (resume draft session after refresh/crash)

### API Layer (Next.js Route Handlers / Edge functions)
- session create/update/finalize endpoints
- signed upload URL issuance
- upload completion verification
- leaderboard query endpoints
- session history query endpoints

### Data Layer
- Supabase Postgres (metadata, sessions, leaderboards)
- Supabase Auth (user identity)
- Cloudflare R2 (final MP4 object storage)

## 3) Deployment Topology
- Frontend/API on Vercel (or equivalent Next.js host)
- Supabase managed backend
- Cloudflare R2 bucket for `timelapses/*`
- CDN delivery for playback URLs (signed, time-limited)

## 4) Trust/Safety Boundaries
- Client can only upload to scoped object key via signed URL
- DB row-level security: users see only own sessions/files
- Leaderboards expose aggregate public data only
- No raw continuous stream persistence server-side
