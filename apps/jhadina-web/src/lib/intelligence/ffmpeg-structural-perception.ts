import {
  createNodeFfmpegDecoder,
  type MediaDecoderAdapter,
} from "@jhadina/director-core";
import type {
  MediaExtractionBackend,
  MediaExtractionObservation,
  MediaExtractionRequest,
} from "@jhadina/intelligence-core";
import type { TrustedAssetReadResolver } from "./trusted-asset-read-resolver";

export interface FfmpegStructuralPerceptionConfig {
  frameRate?: number;
  maxFrames?: number;
  audioSampleRate?: number;
  maxAudioWindows?: number;
}

/**
 * Real structural extraction using the existing Director FFmpeg decoder.
 * This produces timing/sample evidence only; it never invents semantic scene,
 * sports, transcript, or music interpretations.
 */
export class FfmpegStructuralPerceptionBackend implements MediaExtractionBackend {
  constructor(
    private readonly resolver: TrustedAssetReadResolver,
    private readonly decoder: MediaDecoderAdapter = createNodeFfmpegDecoder(),
    private readonly config: FfmpegStructuralPerceptionConfig = {},
  ) {}

  async extract(input: MediaExtractionRequest) {
    if (input.modality !== "video" && input.modality !== "audio") {
      return Object.freeze({ observations: Object.freeze([]), uncertainty: Object.freeze([]) });
    }

    const source = await this.resolver.signedReadUrl({
      actorId: input.actorId,
      assetRef: input.assetRef,
    });
    const startSeconds = input.segment ? input.segment.startMs / 1000 : undefined;
    const endSeconds = input.segment ? input.segment.endMs / 1000 : undefined;
    const observations: MediaExtractionObservation[] = [];

    if (input.modality === "video") {
      const frameRate = this.config.frameRate ?? 1;
      const maxFrames = this.config.maxFrames ?? 24;
      const controller = new AbortController();
      let count = 0;

      for await (const frame of this.decoder.decodeFrames({
        source,
        assetId: input.assetId,
        startSeconds,
        endSeconds,
        frameRate,
        signal: controller.signal,
      })) {
        observations.push({
          kind: "video.frame.sample",
          summary: `FFmpeg extracted frame sample at ${frame.timestampSeconds.toFixed(3)} seconds.`,
        });
        count += 1;
        if (count >= maxFrames) {
          controller.abort();
          break;
        }
      }
    }

    const audioSampleRate = this.config.audioSampleRate ?? 16000;
    const maxAudioWindows = this.config.maxAudioWindows ?? 30;
    const audioController = new AbortController();
    let audioCount = 0;

    for await (const audio of this.decoder.decodeAudio({
      source,
      assetId: input.assetId,
      startSeconds,
      endSeconds,
      audioSampleRate,
      signal: audioController.signal,
    })) {
      observations.push({
        kind: input.modality === "video" ? "video.audio.window" : "audio.window",
        summary: `FFmpeg extracted mono audio window from ${audio.startSeconds.toFixed(3)} to ${audio.endSeconds.toFixed(3)} seconds at ${audioSampleRate} Hz.`,
      });
      audioCount += 1;
      if (audioCount >= maxAudioWindows) {
        audioController.abort();
        break;
      }
    }

    return Object.freeze({
      observations: Object.freeze(observations),
      uncertainty: Object.freeze([
        "FFmpeg structural observations contain timing/sample facts only; semantic interpretation comes from a separate perception provider.",
      ]),
    });
  }
}

export class CompositeMediaExtractionBackend implements MediaExtractionBackend {
  constructor(private readonly backends: readonly MediaExtractionBackend[]) {
    if (!backends.length) throw new Error("PERCEPTION_BACKEND_REQUIRED");
  }

  async extract(input: MediaExtractionRequest) {
    const results = [];
    for (const backend of this.backends) results.push(await backend.extract(input));
    return Object.freeze({
      observations: Object.freeze(results.flatMap((result) => result.observations)),
      uncertainty: Object.freeze([...new Set(results.flatMap((result) => result.uncertainty ?? []))]),
    });
  }
}
