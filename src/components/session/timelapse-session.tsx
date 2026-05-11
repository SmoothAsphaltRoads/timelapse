"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACTIVE_CAPTURE_INTERVAL_MS = 45_000;
const INACTIVE_CAPTURE_INTERVAL_MS = 300_000;
const INACTIVITY_TIMEOUT_MS = 90_000;
const ACTIVITY_STATE_CHECK_MS = 15_000;
const MAX_CAPTURED_FRAMES = 720;
const CAPTURE_MAX_WIDTH = 640;
const CAPTURE_MAX_HEIGHT = 360;
const CAPTURE_QUALITY = 0.45;
const DRAFT_STORAGE_KEY = "timelapse-session-draft-v1";

const FRAMES_DB_NAME = "timelapse-local";
const FRAMES_DB_VERSION = 1;
const FRAMES_STORE = "frames";
const FFMPEG_CORE_VERSION = "0.12.10";

type SessionPhase =
  | "idle"
  | "requesting_permission"
  | "active"
  | "inactive"
  | "interrupted"
  | "stopped"
  | "encoding"
  | "completed";

type StoredFrame = {
  sessionId: string;
  index: number;
  capturedAt: number;
  activeAtCapture: boolean;
  width: number;
  height: number;
  blob: Blob;
};

type SessionDraft = {
  sessionId: string;
  startedAt: number;
  frameCount: number;
  lastCaptureAt: number | null;
  phase: SessionPhase;
  isUserActive: boolean;
};

type BrowserCapabilities = {
  displayMedia: boolean;
  indexedDb: boolean;
  canvasCapture: boolean;
};

type FfmpegModule = {
  loaded: boolean;
  load: (config: { coreURL: string; wasmURL: string }) => Promise<boolean | void>;
  writeFile: (path: string, data: Uint8Array) => Promise<boolean | void>;
  exec: (args: string[]) => Promise<number>;
  readFile: (path: string) => Promise<Uint8Array>;
  deleteFile: (path: string) => Promise<boolean | void>;
};

let framesDbPromise: Promise<IDBDatabase> | null = null;

function createSessionId() {
  const randomValues = new Uint32Array(2);
  crypto.getRandomValues(randomValues);
  const randomSuffix = `${randomValues[0].toString(36)}${randomValues[1].toString(36)}`;
  return `session-${Date.now()}-${randomSuffix.slice(0, 12)}`;
}

function hasDisplayMediaSupport() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia
  );
}

function hasCanvasCaptureSupport() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    !!HTMLCanvasElement.prototype.toBlob
  );
}

function hasIndexedDbSupport() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function openFramesDb(): Promise<IDBDatabase> {
  if (!hasIndexedDbSupport()) {
    throw new Error("IndexedDB is not available in this browser.");
  }

  if (!framesDbPromise) {
    framesDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(FRAMES_DB_NAME, FRAMES_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore(FRAMES_STORE, { keyPath: ["sessionId", "index"] });
        store.createIndex("by_session", "sessionId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  return framesDbPromise;
}

async function putFrame(frame: StoredFrame): Promise<void> {
  const db = await openFramesDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(FRAMES_STORE).put(frame);
  });
}

async function listSessionFrames(sessionId: string): Promise<StoredFrame[]> {
  const db = await openFramesDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, "readonly");
    const store = transaction.objectStore(FRAMES_STORE);
    const index = store.index("by_session");
    const request = index.getAll(IDBKeyRange.only(sessionId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const frames = (request.result as StoredFrame[]).sort((a, b) => a.index - b.index);
      resolve(frames);
    };
  });
}

async function clearSessionFrames(sessionId: string): Promise<void> {
  const db = await openFramesDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FRAMES_STORE, "readwrite");
    const store = transaction.objectStore(FRAMES_STORE);
    const index = store.index("by_session");
    const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      store.delete(cursor.primaryKey);
      cursor.continue();
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function formatRelativeDate(timestamp: number | null) {
  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function readSessionDraft(): SessionDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawDraft = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  if (!rawDraft) {
    return null;
  }

  try {
    return JSON.parse(rawDraft) as SessionDraft;
  } catch (parseError) {
    console.error(parseError);
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

export function TimelapseSession() {
  const [savedDraft] = useState<SessionDraft | null>(() => readSessionDraft());
  const [phase, setPhase] = useState<SessionPhase>(() =>
    savedDraft ? (savedDraft.phase === "active" || savedDraft.phase === "inactive" ? "interrupted" : savedDraft.phase) : "idle",
  );
  const [sessionId, setSessionId] = useState<string | null>(() => savedDraft?.sessionId ?? null);
  const [startedAt, setStartedAt] = useState<number | null>(() => savedDraft?.startedAt ?? null);
  const [frameCount, setFrameCount] = useState(() => savedDraft?.frameCount ?? 0);
  const [isUserActive, setIsUserActive] = useState(() => savedDraft?.isUserActive ?? true);
  const [lastCaptureAt, setLastCaptureAt] = useState<number | null>(() => savedDraft?.lastCaptureAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(() =>
    savedDraft ? "Recovered local session draft after reload." : "No active session.",
  );
  const [mp4Url, setMp4Url] = useState<string | null>(null);
  const [mp4Size, setMp4Size] = useState<number | null>(null);
  const [isLoadingFfmpeg, setIsLoadingFfmpeg] = useState(false);
  const [capabilities] = useState<BrowserCapabilities>(() => ({
    displayMedia: hasDisplayMediaSupport(),
    indexedDb: hasIndexedDbSupport(),
    canvasCapture: hasCanvasCaptureSupport(),
  }));

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const activityCheckRef = useRef<number | null>(null);
  const ffmpegRef = useRef<FfmpegModule | null>(null);
  const lastActivityAtRef = useRef(0);
  const captureInFlightRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionEndingRef = useRef(false);
  const frameIndexRef = useRef(0);

  const captureIntervalMs = isUserActive ? ACTIVE_CAPTURE_INTERVAL_MS : INACTIVE_CAPTURE_INTERVAL_MS;
  const isSharing = phase === "active" || phase === "inactive";

  const clearCaptureTimer = useCallback(() => {
    if (captureTimerRef.current !== null) {
      window.clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }, []);

  const clearActivityTimer = useCallback(() => {
    if (activityCheckRef.current !== null) {
      window.clearInterval(activityCheckRef.current);
      activityCheckRef.current = null;
    }
  }, []);

  const markActivity = useCallback(() => {
    const now = Date.now();
    lastActivityAtRef.current = now;

    setIsUserActive((previous) => {
      if (!previous) {
        setStatusNote("Activity detected. Switched to fast capture interval.");
      }
      return true;
    });
  }, []);

  const stopCurrentStream = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.onended = null;
      trackRef.current.stop();
      trackRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        if (track.readyState !== "ended") {
          track.stop();
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetSession = useCallback(
    async (clearFrames: boolean) => {
      sessionEndingRef.current = true;
      clearCaptureTimer();
      clearActivityTimer();
      stopCurrentStream();

      if (clearFrames && sessionId) {
        try {
          await clearSessionFrames(sessionId);
        } catch (cleanupError) {
          console.error(cleanupError);
        }
      }

      if (mp4Url) {
        URL.revokeObjectURL(mp4Url);
      }

      setMp4Url(null);
      setMp4Size(null);
      setSessionId(null);
      setStartedAt(null);
      setFrameCount(0);
      setLastCaptureAt(null);
      setIsUserActive(true);
      setPhase("idle");
      setError(null);
      setStatusNote("Session cleared.");
      sessionEndingRef.current = false;
      frameIndexRef.current = 0;
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    },
    [clearActivityTimer, clearCaptureTimer, mp4Url, sessionId, stopCurrentStream],
  );

  const captureFrame = useCallback(async () => {
    if (!sessionId || !videoRef.current || !canvasRef.current || captureInFlightRef.current) {
      return;
    }

    if (frameIndexRef.current >= MAX_CAPTURED_FRAMES) {
      setStatusNote("Capture limit reached to keep memory usage low.");
      return;
    }

    const video = videoRef.current;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      return;
    }

    captureInFlightRef.current = true;
    try {
      const sourceRatio = sourceWidth / sourceHeight;
      let targetWidth = CAPTURE_MAX_WIDTH;
      let targetHeight = Math.round(targetWidth / sourceRatio);

      if (targetHeight > CAPTURE_MAX_HEIGHT) {
        targetHeight = CAPTURE_MAX_HEIGHT;
        targetWidth = Math.round(targetHeight * sourceRatio);
      }

      const canvas = canvasRef.current;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        throw new Error("Canvas context unavailable.");
      }

      context.drawImage(video, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (!nextBlob) {
            reject(new Error("Failed to extract frame blob."));
            return;
          }
          resolve(nextBlob);
        }, "image/jpeg", CAPTURE_QUALITY);
      });

      const nextIndex = frameIndexRef.current;
      const now = Date.now();
      await putFrame({
        sessionId,
        index: nextIndex,
        capturedAt: now,
        activeAtCapture: isUserActive,
        width: targetWidth,
        height: targetHeight,
        blob,
      });

      frameIndexRef.current += 1;
      setFrameCount((current) => current + 1);
      setLastCaptureAt(now);
    } catch (captureError) {
      console.error(captureError);
      setError(captureError instanceof Error ? captureError.message : "Failed to capture frame.");
    } finally {
      captureInFlightRef.current = false;
    }
  }, [isUserActive, sessionId]);

  const scheduleCapture = useCallback(() => {
    clearCaptureTimer();

    const runCapture = async () => {
      await captureFrame();
      if (streamRef.current && !sessionEndingRef.current) {
        captureTimerRef.current = window.setTimeout(runCapture, captureIntervalMs);
      }
    };

    captureTimerRef.current = window.setTimeout(runCapture, captureIntervalMs);
  }, [captureFrame, captureIntervalMs, clearCaptureTimer]);

  const handleUnexpectedStreamEnd = useCallback(() => {
    if (sessionEndingRef.current) {
      return;
    }

    clearCaptureTimer();
    stopCurrentStream();
    setPhase("interrupted");
    setStatusNote("Screen sharing was interrupted. You can recover and continue.");
  }, [clearCaptureTimer, stopCurrentStream]);

  const startShare = useCallback(async () => {
    setError(null);

    if (!capabilities.displayMedia) {
      setError("Screen sharing is not supported in this browser.");
      return;
    }

    if (!capabilities.canvasCapture || !capabilities.indexedDb) {
      setError("This browser is missing required capture/storage capabilities.");
      return;
    }

    sessionEndingRef.current = false;
    setPhase("requesting_permission");
    setStatusNote("Requesting screen share permission...");

    try {
      const activeSessionId = sessionId ?? createSessionId();
      if (!sessionId) {
        setSessionId(activeSessionId);
        setStartedAt(Date.now());
        setFrameCount(0);
        setLastCaptureAt(null);
        frameIndexRef.current = 0;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: { max: 1 },
          width: { max: 1280 },
          height: { max: 720 },
        },
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("No screen track available.");
      }

      track.onended = () => {
        handleUnexpectedStreamEnd();
      };

      streamRef.current = stream;
      trackRef.current = track;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      markActivity();
      setPhase("active");
      setStatusNote("Screen sharing active. Sparse capture scheduler running.");
      await captureFrame();
      scheduleCapture();
    } catch (startError) {
      stopCurrentStream();
      setPhase(sessionId ? "interrupted" : "idle");

      const displayError =
        startError instanceof DOMException && startError.name === "NotAllowedError"
          ? "Screen sharing permission was denied."
          : startError instanceof Error
            ? startError.message
            : "Unable to start screen sharing.";

      setError(displayError);
      setStatusNote("Failed to start screen sharing.");
    }
  }, [
    capabilities.canvasCapture,
    capabilities.displayMedia,
    capabilities.indexedDb,
    captureFrame,
    handleUnexpectedStreamEnd,
    markActivity,
    scheduleCapture,
    sessionId,
    stopCurrentStream,
  ]);

  const stopSession = useCallback(() => {
    sessionEndingRef.current = true;
    clearCaptureTimer();
    stopCurrentStream();
    setPhase("stopped");
    setStatusNote("Session stopped. You can now generate MP4.");
  }, [clearCaptureTimer, stopCurrentStream]);

  const loadFfmpeg = useCallback(async (): Promise<FfmpegModule> => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }

    setIsLoadingFfmpeg(true);
    try {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);

      const ffmpeg = new FFmpeg() as unknown as FfmpegModule;
      const baseUrl = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;
      const coreURL = await toBlobURL(`${baseUrl}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, "application/wasm");

      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } finally {
      setIsLoadingFfmpeg(false);
    }
  }, []);

  const generateTimelapse = useCallback(async () => {
    if (isSharing) {
      setError("Stop screen sharing before generating the MP4.");
      return;
    }

    if (!sessionId) {
      setError("No local session was found.");
      return;
    }

    setError(null);
    setPhase("encoding");
    setStatusNote("Generating MP4 timelapse locally...");

    try {
      const frames = await listSessionFrames(sessionId);
      if (frames.length === 0) {
        throw new Error("No frames captured yet.");
      }

      const ffmpeg = await loadFfmpeg();
      const imageNames: string[] = [];

      for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        const imageName = `frame-${String(index).padStart(6, "0")}.jpg`;
        const fileData = new Uint8Array(await frame.blob.arrayBuffer());
        await ffmpeg.writeFile(imageName, fileData);
        imageNames.push(imageName);
      }

      const outputName = `timelapse-${sessionId}.mp4`;
      await ffmpeg.exec([
        "-framerate",
        "8",
        "-i",
        "frame-%06d.jpg",
        "-vf",
        "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "33",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputName,
      ]);

      const output = await ffmpeg.readFile(outputName);
      const outputCopy = new Uint8Array(output);
      const blob = new Blob([outputCopy], { type: "video/mp4" });

      imageNames.forEach((imageName) => {
        void ffmpeg.deleteFile(imageName);
      });
      void ffmpeg.deleteFile(outputName);

      if (mp4Url) {
        URL.revokeObjectURL(mp4Url);
      }

      const nextMp4Url = URL.createObjectURL(blob);
      setMp4Url(nextMp4Url);
      setMp4Size(blob.size);
      setPhase("completed");
      setStatusNote("MP4 generated locally. Download when ready.");
    } catch (encodeError) {
      console.error(encodeError);
      setPhase("stopped");
      setError(encodeError instanceof Error ? encodeError.message : "Failed to generate timelapse.");
      setStatusNote("MP4 generation failed.");
    }
  }, [isSharing, loadFfmpeg, mp4Url, sessionId]);

  useEffect(() => {
    frameIndexRef.current = frameCount;
  }, [frameCount]);

  useEffect(() => {
    if (!sessionId || !startedAt) {
      return;
    }

    const draft: SessionDraft = {
      sessionId,
      startedAt,
      frameCount,
      lastCaptureAt,
      phase,
      isUserActive,
    };

    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [frameCount, isUserActive, lastCaptureAt, phase, sessionId, startedAt]);

  useEffect(() => {
    const onMouseMove = () => markActivity();
    const onKeyDown = () => markActivity();

    lastActivityAtRef.current = Date.now();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });

    clearActivityTimer();
    activityCheckRef.current = window.setInterval(() => {
      const isActiveNow = Date.now() - lastActivityAtRef.current <= INACTIVITY_TIMEOUT_MS;
      setIsUserActive((previous) => {
        if (previous !== isActiveNow) {
          setStatusNote(
            isActiveNow
              ? "Activity resumed. Using fast capture interval."
              : "No activity detected. Switched to low-power capture interval.",
          );
        }
        return isActiveNow;
      });
    }, ACTIVITY_STATE_CHECK_MS);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      clearActivityTimer();
    };
  }, [clearActivityTimer, markActivity]);

  useEffect(() => {
    if (!isSharing || !streamRef.current) {
      clearCaptureTimer();
      return;
    }

    setPhase(isUserActive ? "active" : "inactive");
    scheduleCapture();
  }, [clearCaptureTimer, isSharing, isUserActive, scheduleCapture]);

  useEffect(() => {
    return () => {
      clearCaptureTimer();
      clearActivityTimer();
      stopCurrentStream();

      if (mp4Url) {
        URL.revokeObjectURL(mp4Url);
      }
    };
  }, [clearActivityTimer, clearCaptureTimer, mp4Url, stopCurrentStream]);

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "requesting_permission":
        return "Requesting permission";
      case "active":
        return "Sharing · active user";
      case "inactive":
        return "Sharing · inactive user";
      case "interrupted":
        return "Interrupted";
      case "stopped":
        return "Stopped";
      case "encoding":
        return "Encoding MP4";
      case "completed":
        return "Completed";
      case "idle":
      default:
        return "Idle";
    }
  }, [phase]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Session controller</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Browser-only sparse capture with local frame storage and post-session MP4 generation.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Session state</p>
          <p className="mt-2 text-lg font-semibold">{phaseLabel}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Captured frames</p>
          <p className="mt-2 text-lg font-semibold">{frameCount}</p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Current interval</p>
          <p className="mt-2 text-lg font-semibold">
            {isUserActive ? "45s (active)" : "5m (inactive)"}
          </p>
        </article>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Controls</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startShare()}
            disabled={phase === "requesting_permission" || isSharing || phase === "encoding"}
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {phase === "requesting_permission" ? "Requesting..." : "Start sharing"}
          </button>
          <button
            type="button"
            onClick={stopSession}
            disabled={!isSharing && phase !== "interrupted"}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Stop sharing
          </button>
          <button
            type="button"
            onClick={() => void generateTimelapse()}
            disabled={phase === "encoding" || isSharing || frameCount === 0}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {phase === "encoding" || isLoadingFfmpeg ? "Generating MP4..." : "Generate MP4"}
          </button>
          <button
            type="button"
            onClick={() => void resetSession(true)}
            disabled={isSharing || phase === "encoding"}
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cleanup local data
          </button>
        </div>

        <dl className="mt-5 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">Session ID</dt>
            <dd className="mt-1 break-all">{sessionId ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">Started</dt>
            <dd className="mt-1">{formatRelativeDate(startedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">Last frame</dt>
            <dd className="mt-1">{formatRelativeDate(lastCaptureAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">Encoder output</dt>
            <dd className="mt-1">
              {mp4Size ? `${(mp4Size / (1024 * 1024)).toFixed(2)} MB` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {mp4Url ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Export</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Timelapse generation runs only after session end and stays entirely in-browser.
          </p>
          <a
            href={mp4Url}
            download={`timelapse-${sessionId ?? "session"}.mp4`}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Download MP4
          </a>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Browser compatibility</h2>
        <ul className="mt-3 space-y-1 text-zinc-600 dark:text-zinc-400">
          <li>Screen share (`getDisplayMedia`): {capabilities.displayMedia ? "Yes" : "No"}</li>
          <li>Canvas frame extraction: {capabilities.canvasCapture ? "Yes" : "No"}</li>
          <li>IndexedDB local frame storage: {capabilities.indexedDb ? "Yes" : "No"}</li>
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="font-medium">{statusNote}</p>
        {error ? <p className="mt-2 text-red-600 dark:text-red-400">{error}</p> : null}
      </section>

      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}
