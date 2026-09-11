import { describe, expect, it } from "vitest";
import { applyTimelineCommand, type TimelineCommand } from "./timeline-command";
import type { EditableTimeline } from "./timeline-model";

const baseTimeline: EditableTimeline = {
  version: 1,
  projectId: "project-1",
  fps: 30,
  width: 1920,
  height: 1080,
  durationSeconds: 20,
  playheadSeconds: 0,
  tracks: [
    {
      id: "video-1",
      name: "Video",
      kind: "video",
      index: 0,
      locked: false,
      clips: [],
    },
  ],
  markers: [],
  transitions: [],
  versions: [],
};

describe("insert-generated-asset", () => {
  it("inserts an SRT asset onto a subtitle track and preserves provenance", () => {
    const command: TimelineCommand = {
      type: "insert-generated-asset",
      asset: {
        assetId: "asset-srt-1",
        generationJobId: "job-123",
        uri: "supabase://generated/job-123/counter.srt",
        mimeType: "application/x-subrip",
        mediaType: "subtitle",
        operationId: "srt-counter",
        sourceId: "raw-video-1",
        startSeconds: 2,
        endSeconds: 8,
        metadata: { countTo: 600, stepSeconds: 0.1 },
      },
    };

    const result = applyTimelineCommand(baseTimeline, command);
    const subtitleTrack = result.tracks.find((track) => track.kind === "subtitle");

    expect(subtitleTrack).toBeDefined();
    expect(subtitleTrack?.locked).toBeUndefined();
    expect(subtitleTrack?.clips).toHaveLength(1);
    expect(subtitleTrack?.clips[0]).toMatchObject({
      assetId: "asset-srt-1",
      startSeconds: 2,
      durationSeconds: 6,
      generativeRegions: [
        {
          resultAssetId: "asset-srt-1",
          metadata: {
            assetId: "asset-srt-1",
            generationJobId: "job-123",
            uri: "supabase://generated/job-123/counter.srt",
            mimeType: "application/x-subrip",
            operationId: "srt-counter",
            sourceId: "raw-video-1",
            countTo: 600,
            stepSeconds: 0.1,
          },
        },
      ],
    });
  });

  it("reuses an existing unlocked subtitle track", () => {
    const timeline: EditableTimeline = {
      ...baseTimeline,
      tracks: [
        ...baseTimeline.tracks,
        { id: "sub-1", name: "Subtitles", kind: "subtitle", index: 1, locked: false, clips: [] },
      ],
    };

    const result = applyTimelineCommand(timeline, {
      type: "insert-generated-asset",
      asset: {
        assetId: "asset-srt-2",
        generationJobId: "job-456",
        uri: "file:///counter.srt",
        mimeType: "application/x-subrip",
        mediaType: "subtitle",
        operationId: "srt-counter",
        startSeconds: 0,
        endSeconds: 3,
      },
    });

    expect(result.tracks.filter((track) => track.kind === "subtitle")).toHaveLength(1);
    expect(result.tracks.find((track) => track.id === "sub-1")?.clips[0]?.assetId).toBe("asset-srt-2");
  });
});
