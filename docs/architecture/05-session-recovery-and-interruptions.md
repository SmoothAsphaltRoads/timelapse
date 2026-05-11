# Session Recovery and Interruption Handling

## 1) Interruption Types
- user stops screen share from browser UI
- tab/app refresh or crash
- temporary offline network
- device sleep/wake
- encoder failure
- upload failure

## 2) Recovery Model
Local-first recovery using IndexedDB draft:
- `draft_session_id`
- start timestamp
- elapsed timer state
- accepted frame index + timestamps
- encoding/upload checkpoint state

On app reload:
1. detect unfinished draft
2. validate user identity/session ownership
3. offer resume or finalize-as-interrupted
4. continue capture or continue encode/upload from checkpoint

## 3) Session State Machine
- `active` -> `interrupted` (share ended/crash/offline timeout)
- `active` -> `encoding` -> `uploading` -> `uploaded`
- `encoding` -> `encode_failed`
- `uploading` -> `interrupted` or `uploading` retry -> `uploaded`
- user cancel -> `cancelled`

## 4) Consistency Rules
- session immutable ownership (`user_id`)
- only one active draft per user/device in MVP
- server finalization requires:
  - ended_at set
  - non-negative duration
  - upload metadata present for `uploaded`
- reconciliation worker handles orphan states (`uploading` too long)

## 5) UX Rules
- always show explicit state badge: Active / Interrupted / Encoding / Uploading / Completed
- preserve trust:
  - show exact capture cadence used
  - show skipped-frame count
  - show interruption markers in session timeline
