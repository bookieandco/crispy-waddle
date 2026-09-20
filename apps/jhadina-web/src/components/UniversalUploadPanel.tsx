"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  createUniversalUploadTask,
  selectPerceptionSubsystems,
  type PerceptionJobView,
  type UniversalUploadProgress,
  type UniversalUploadTask,
} from "@/lib/intelligence/universal-upload-client";

type PrivacyClass = "internal" | "sensitive" | "restricted";

const ROUTE_LABELS: Record<string, string> = {
  "sports-intelligence": "Sports Intelligence",
  "jhadina-media": "Jhadina Media",
  "director-studio": "Director Studio",
  "creative-engine": "Creative Engine",
  overageos: "OverageOS",
  knowledge: "Knowledge",
  research: "Research",
};

function routeLabel(id: string): string {
  return ROUTE_LABELS[id] ?? id.replaceAll("-", " ");
}

function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function phaseLabel(progress: UniversalUploadProgress | null): string {
  if (!progress) return "";
  switch (progress.phase) {
    case "preparing": return "Preparing secure upload…";
    case "uploading": return `Uploading… ${progress.percent}%`;
    case "paused": return "Upload paused";
    case "finalizing": return "Scanning and securing upload…";
    case "processing": return "Jhadina is analyzing it…";
    case "needs_selection": return "Choose where Jhadina should use this";
    case "completed": return "Analysis complete";
    case "failed": return progress.message || "Upload failed";
  }
}

export function UniversalUploadPanel({ intent }: { intent?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const taskRef = useRef<UniversalUploadTask | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  const runRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [privacyClass, setPrivacyClass] = useState<PrivacyClass>("sensitive");
  const [progress, setProgress] = useState<UniversalUploadProgress | null>(null);
  const [job, setJob] = useState<PerceptionJobView | null>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      runRef.current += 1;
      taskRef.current?.pause();
    };
  }, []);

  function openPicker() {
    inputRef.current?.click();
  }

  async function beginUpload(nextFile: File) {
    const runId = ++runRef.current;
    setFile(nextFile);
    setJob(null);
    setSelectedRoutes([]);
    setError("");
    setProgress({
      phase: "preparing",
      uploadedBytes: 0,
      totalBytes: nextFile.size,
      percent: 0,
    });

    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not signed in");
      userIdRef.current = userId;

      const task = createUniversalUploadTask({
        file: nextFile,
        intent: intent?.trim() || undefined,
        privacyClass,
        userId,
        callbacks: {
          onProgress(next) {
            if (runRef.current !== runId) return;
            setProgress(next);
            if (next.job) setJob(next.job);
          },
        },
      });
      taskRef.current = task;
      const result = await task.promise;
      if (runRef.current === runId) setJob(result);
    } catch (cause) {
      if (runRef.current !== runId) return;
      const message = cause instanceof Error ? cause.message : "Upload failed";
      setError(message);
      setProgress((current) => ({
        phase: "failed",
        uploadedBytes: current?.uploadedBytes ?? 0,
        totalBytes: nextFile.size,
        percent: current?.percent ?? 0,
        message,
      }));
    }
  }

  function reset() {
    runRef.current += 1;
    taskRef.current?.pause();
    taskRef.current = null;
    setFile(null);
    setProgress(null);
    setJob(null);
    setSelectedRoutes([]);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleRoute(subsystem: string) {
    setSelectedRoutes((current) =>
      current.includes(subsystem)
        ? current.filter((item) => item !== subsystem)
        : [...current, subsystem],
    );
  }

  async function submitRouteSelection() {
    if (!job || job.status !== "needs_selection" || selectedRoutes.length === 0) return;
    setRouteBusy(true);
    setError("");
    try {
      const result = await selectPerceptionSubsystems({
        jobId: job.id,
        subsystems: selectedRoutes,
        userId: userIdRef.current,
        callbacks: {
          onProgress(next) {
            setProgress(next);
            if (next.job) setJob(next.job);
          },
        },
      });
      setJob(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not route this upload");
    } finally {
      setRouteBusy(false);
    }
  }

  const routes = job?.proposedRoutes ?? [];
  const completedRoutes = job?.dispatch?.responses.map((response) => response.subsystem) ?? [];

  return (
    <section aria-label="Upload to Jhadina" style={{ marginTop: 10 }}>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/ogg,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,application/pdf,text/plain,text/markdown,text/csv,application/json,application/javascript,text/javascript,application/typescript,text/typescript,.md,.csv,.json,.js,.ts"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) void beginUpload(next);
        }}
      />

      {!file ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={openPicker} style={attachButton}>
            ＋ Attach a file
          </button>
          <select
            aria-label="Upload privacy"
            value={privacyClass}
            onChange={(event) => setPrivacyClass(event.target.value as PrivacyClass)}
            style={privacySelect}
          >
            <option value="internal">Internal</option>
            <option value="sensitive">Sensitive</option>
            <option value="restricted">Restricted</option>
          </select>
          <span style={{ fontSize: 12, color: "#849087" }}>
            Videos, audio, images, PDFs, text and code
          </span>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={fileIcon}>↥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, color: "#77847c" }}>
                {bytesLabel(file.size)} · {privacyClass}
                {taskRef.current?.direct ? " · resumable" : ""}
              </div>
            </div>
            <button type="button" onClick={reset} style={closeButton} aria-label="Clear upload">×</button>
          </div>

          {progress && (
            <>
              <div style={{ marginTop: 14, height: 6, borderRadius: 999, overflow: "hidden", background: "#e5eae6" }}>
                <div
                  aria-label="Upload progress"
                  style={{
                    height: "100%",
                    width: `${progress.phase === "processing" || progress.phase === "needs_selection" || progress.phase === "completed" ? 100 : progress.percent}%`,
                    background: "#51675c",
                    transition: "width 180ms ease",
                  }}
                />
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: progress.phase === "failed" ? "#8d5148" : "#657169" }}>
                  {phaseLabel(progress)}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {taskRef.current?.direct && progress.phase === "uploading" && (
                    <button type="button" style={tinyButton} onClick={() => taskRef.current?.pause()}>
                      Pause
                    </button>
                  )}
                  {taskRef.current?.direct && progress.phase === "paused" && (
                    <button type="button" style={tinyButton} onClick={() => void taskRef.current?.resume()}>
                      Resume
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {job?.status === "needs_selection" && routes.length > 0 && (
            <div style={{ marginTop: 16, padding: 13, borderRadius: 15, background: "#f0eee8" }}>
              <div style={{ fontSize: 12, color: "#59665f", lineHeight: 1.5 }}>
                This file matches more than one Jhadina world. Choose every destination that should receive the evidence.
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                {routes.map((route) => {
                  const selected = selectedRoutes.includes(route.subsystem);
                  return (
                    <button
                      type="button"
                      key={route.subsystem}
                      onClick={() => toggleRoute(route.subsystem)}
                      aria-pressed={selected}
                      title={route.reason}
                      style={{
                        ...routeChip,
                        background: selected ? "#34443c" : "rgba(255,255,255,.75)",
                        color: selected ? "#fff" : "#4f5d55",
                        borderColor: selected ? "#34443c" : "#d2d9d3",
                      }}
                    >
                      {routeLabel(route.subsystem)}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={routeBusy || selectedRoutes.length === 0}
                onClick={() => void submitRouteSelection()}
                style={{ ...continueButton, opacity: routeBusy || selectedRoutes.length === 0 ? 0.5 : 1 }}
              >
                {routeBusy ? "Routing…" : "Continue analysis"}
              </button>
            </div>
          )}

          {job?.status === "completed" && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "#eaf0eb", color: "#536159", fontSize: 12, lineHeight: 1.5 }}>
              {completedRoutes.length > 0
                ? <>Sent as governed evidence to {completedRoutes.map(routeLabel).join(", ")}.</>
                : <>Analysis completed. No subsystem action was executed from the upload itself.</>}
            </div>
          )}

          {(error || job?.status === "failed") && (
            <div role="alert" style={{ marginTop: 12, color: "#8d5148", fontSize: 12 }}>
              {error || job?.lastError || "Upload processing failed"}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const attachButton = {
  border: "1px solid #d4dcd5",
  borderRadius: 999,
  padding: "8px 13px",
  background: "rgba(255,255,255,.58)",
  color: "#526058",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const privacySelect = {
  border: "1px solid #d4dcd5",
  borderRadius: 999,
  padding: "7px 10px",
  background: "rgba(255,255,255,.58)",
  color: "#637068",
  fontSize: 12,
};

const card = {
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,.68)",
  border: "1px solid #d9e0da",
};

const fileIcon = {
  width: 32,
  height: 32,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "#e9eee9",
  color: "#58675f",
  fontWeight: 700,
};

const closeButton = {
  border: 0,
  background: "transparent",
  color: "#7d8982",
  fontSize: 20,
  cursor: "pointer",
  lineHeight: 1,
};

const tinyButton = {
  border: "1px solid #d4dcd5",
  borderRadius: 999,
  padding: "5px 9px",
  background: "rgba(255,255,255,.7)",
  color: "#59665f",
  fontSize: 11,
  fontWeight: 650,
  cursor: "pointer",
};

const routeChip = {
  border: "1px solid #d2d9d3",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 650,
  cursor: "pointer",
};

const continueButton = {
  marginTop: 11,
  border: 0,
  borderRadius: 999,
  padding: "8px 12px",
  background: "#34443c",
  color: "#f8f6f1",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
