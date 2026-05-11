# End-to-End Data Flow

## A) Session Start
1. User signs in.
2. Client calls `POST /api/sessions` -> creates `study_sessions` row (`status='active'`).
3. Client requests screen share (`getDisplayMedia`).
4. Timer starts; local draft persisted to IndexedDB.

## B) Sparse Capture Loop
1. Activity detector classifies user as `active` or `inactive`.
2. Capture scheduler interval:
   - active: every 45s
   - inactive: every 300s
3. Each capture:
   - draw current frame to OffscreenCanvas/Canvas
   - optional downscale/compress to JPEG/WebP blob
   - compute perceptual hash/similarity
   - skip if nearly identical (optional)
   - persist accepted frame + timestamp in IndexedDB
4. Client updates lightweight heartbeat in DB (`last_client_heartbeat_at`, frame counters).

## C) Session End
1. User stops session or share ends/interruption.
2. Client finalizes capture queue.
3. Worker encodes frames -> MP4 (target low bitrate).
4. Client requests signed R2 upload URL.
5. Client uploads MP4.
6. Client calls upload-complete endpoint with object metadata.
7. Session row updated to `status='uploaded'` and finalized duration.

## D) Read Paths
- Session history page: query own sessions sorted by `started_at desc`.
- Leaderboard page: query aggregated study duration (daily/weekly).
- Timelapse playback page: request signed read URL, stream MP4 from R2.
