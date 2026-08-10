import type { AudioFeatures } from "./audio-features.js";
import type { CreativeObservation } from "../../domain/observation.js";

export function buildMusicObservations(
  mediaId: string,
  features: AudioFeatures,
): CreativeObservation[] {
  const observations: CreativeObservation[] = [];

  if (features.firstHookMs !== undefined) {
    observations.push({
      id: `${mediaId}:early-hook`,
      mediaId,
      domain: "music",
      technique: "early_hook",
      startMs: 0,
      endMs: features.firstHookMs,
      measurement: { firstHookMs: features.firstHookMs },
      interpretation: "First detected hook occurs at the measured position.",
      evidence: [{ source: "audio-analysis", locator: mediaId }],
      confidence: 0.9,
    });
  }

  if (features.bpm !== undefined) {
    observations.push({
      id: `${mediaId}:tempo`,
      mediaId,
      domain: "music",
      technique: "tempo",
      measurement: { bpm: features.bpm },
      interpretation: `Detected tempo is ${features.bpm} BPM.`,
      evidence: [{ source: "audio-analysis", locator: mediaId }],
      confidence: 0.85,
    });
  }

  if (features.transitionPoints?.length) {
    observations.push({
      id: `${mediaId}:transitions`,
      mediaId,
      domain: "music",
      technique: "arrangement_transitions",
      measurement: { transitionPoints: features.transitionPoints },
      interpretation: "Audio analysis detected significant transition points.",
      evidence: [{ source: "audio-analysis", locator: mediaId }],
      confidence: 0.8,
    });
  }

  return observations;
}
