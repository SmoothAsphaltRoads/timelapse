# Storage Lifecycle and Upload Flow

## 1) Local Storage Lifecycle (Client)
- In-memory queue: newest pending frames
- IndexedDB stores:
  - `session_draft` metadata
  - accepted sparse frame blobs
  - encoder checkpoints (optional)
- On encode success: delete frame blobs after MP4 integrity check
- On upload success: clear draft + local MP4 blob
- On failure: retain draft for retry/resume

## 2) Remote Storage Lifecycle (R2)
Object key strategy:
`timelapses/{user_id}/{yyyy}/{mm}/{session_id}.mp4`

Metadata on object:
- `session_id`
- `user_id`
- `started_at`
- `ended_at`
- `duration_sec`
- `frame_count`
- `sha256`

Retention:
- default keep indefinitely (MVP)
- optional future tiering/lifecycle by age
- delete object when session deleted by user (hard-delete path)

## 3) Upload Flow (Resumable-Friendly)
1. Client asks API for signed PUT/multipart upload contract.
2. API validates session ownership + status.
3. Client uploads MP4 directly to R2 (not through app server).
4. Client sends completion payload (`etag`, `size`, `sha256`).
5. API verifies object exists/metadata and marks session uploaded.
6. If completion call missing, a reconciliation job marks stale uploads.

## 4) Failure Handling
- Network fail during upload -> retry with backoff
- Browser close mid-upload -> recover from IndexedDB draft
- Signed URL expired -> request new signed URL
- Encode fail -> mark session `encode_failed`, preserve draft frames
