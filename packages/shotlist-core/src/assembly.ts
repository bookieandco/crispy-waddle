/**
 * Assembly / timeline layer.
 *
 * The generation models this pipeline can actually call (Wan2.2,
 * Seedance 2.0) top out around 5–15 seconds per clip — confirmed against
 * Wan-Video/Wan2.2 (~5s @ 720p, GPU-only). There is no single "make one
 * long video" model to reach for. Longer-form output has to come from
 * stitching many short generated clips together, in order, with
 * transitions and an optional localization pass — an editorial problem,
 * not a generation problem. That's what this module does: it turns the
 * existing ordered `Shot[]` plus externally-generated clip references
 * into a `Timeline` (an edit-decision list), and reports gaps instead of
 * failing when a shot has no clip yet.
 *
 * This module does not generate, transcode, or render anything itself —
 * no FFmpeg, no GPU calls. It is pure data assembly, deliberately, so it
 * has no infrastructure requirement beyond what this package already
 * has none of.
 */
import type { Shot } from "./types.js";

/** A reference to an already-generated clip for one shot. Generation
 * itself happens outside this package — see `external-adapters.ts`. */
export interface ClipRef {
  shotId: string;
  uri: string;
  provider: string;
  durationSec: number;
}

export type TransitionKind = "cut" | "crossfade" | "dip-to-black" | "wipe";

export interface EditDecision {
  shotId: string;
  clip: ClipRef;
  transitionIn: TransitionKind;
  startSec: number;
  durationSec: number;
}

/** A localization track layered onto the finished timeline: subtitles
 * and/or a dubbed audio track for one language. Modeled on VideoLingo's
 * actual output shape (Huanshere/VideoLingo — subtitles + dubbed audio),
 * not vendored — that project is a Python/Streamlit app, wrong stack for
 * this package, and this is just the shape its output needs to slot
 * into here. */
export interface LocalizationTrack {
  language: string;
  subtitleUri?: string;
  dubAudioUri?: string;
}

export interface Timeline {
  projectId: string;
  edits: EditDecision[];
  localization: LocalizationTrack[];
  totalDurationSec: number;
  /** Shots that have no matching clip yet. Reported, not thrown — an
   * in-progress shotlist is the normal case while generation is still
   * catching up, not an error state. */
  missingClips: string[];
}

export interface BuildTimelineOptions {
  defaultTransition?: TransitionKind;
  /** Per-shot transition override, keyed by shot id. */
  transitions?: Record<string, TransitionKind>;
  localization?: LocalizationTrack[];
}

function shotOrder(a: Shot, b: Shot): number {
  return a.sceneScriptOrder - b.sceneScriptOrder || a.ordinal - b.ordinal;
}

/**
 * Stitches an ordered shot list and a pool of generated clips into a
 * timeline. Shots are ordered by `sceneScriptOrder` then `ordinal` —
 * the same ordering the shotlist is already drafted in, so this is a
 * pure re-projection, not a second source of truth for shot order.
 */
export function buildTimeline(
  projectId: string,
  shots: Shot[],
  clips: ClipRef[],
  options: BuildTimelineOptions = {},
): Timeline {
  const clipsByShot = new Map(clips.map((clip) => [clip.shotId, clip]));
  const ordered = [...shots].sort(shotOrder);

  const edits: EditDecision[] = [];
  const missingClips: string[] = [];
  let cursor = 0;

  for (const shot of ordered) {
    const clip = clipsByShot.get(shot.id);
    if (!clip) {
      missingClips.push(shot.id);
      continue;
    }
    const transitionIn = options.transitions?.[shot.id] ?? options.defaultTransition ?? "cut";
    edits.push({ shotId: shot.id, clip, transitionIn, startSec: cursor, durationSec: clip.durationSec });
    cursor += clip.durationSec;
  }

  return {
    projectId,
    edits,
    localization: options.localization ?? [],
    totalDurationSec: cursor,
    missingClips,
  };
}
