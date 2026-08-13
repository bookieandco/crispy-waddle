import type { Shot } from "./types.js";

export interface ClipRef { shotId: string; uri: string; provider: string; durationSec: number; }
export type TransitionKind = "cut" | "crossfade" | "dip-to-black" | "wipe";
export interface EditDecision { shotId: string; clip: ClipRef; transitionIn: TransitionKind; startSec: number; durationSec: number; }
export interface LocalizationTrack { language: string; subtitleUri?: string; dubAudioUri?: string; }
export interface Timeline { projectId: string; edits: EditDecision[]; localization: LocalizationTrack[]; totalDurationSec: number; missingClips: string[]; }
export interface BuildTimelineOptions { defaultTransition?: TransitionKind; transitions?: Record<string, TransitionKind>; localization?: LocalizationTrack[]; }

function shotOrder(a: Shot, b: Shot): number { return a.sceneScriptOrder - b.sceneScriptOrder || a.ordinal - b.ordinal; }

export function buildTimeline(projectId: string, shots: Shot[], clips: ClipRef[], options: BuildTimelineOptions = {}): Timeline {
  const clipsByShot = new Map(clips.map((clip) => [clip.shotId, clip]));
  const ordered = [...shots].sort(shotOrder);
  const edits: EditDecision[] = [];
  const missingClips: string[] = [];
  let cursor = 0;
  for (const shot of ordered) {
    const clip = clipsByShot.get(shot.id);
    if (!clip) { missingClips.push(shot.id); continue; }
    const transitionIn = options.transitions?.[shot.id] ?? options.defaultTransition ?? "cut";
    edits.push({ shotId: shot.id, clip, transitionIn, startSec: cursor, durationSec: clip.durationSec });
    cursor += clip.durationSec;
  }
  return { projectId, edits, localization: options.localization ?? [], totalDurationSec: cursor, missingClips };
}
