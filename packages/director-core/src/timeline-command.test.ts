import { describe, expect, it } from "vitest";
import { applyTimelineCommand, type TimelineCommand } from "./timeline-command";

const baseTimeline = {
  durationSeconds: 20,
  tracks: [
    {
      id: "video-1",
      type: "video" as const,
      locked: false,
      clips: [],
    },
  ],
  markers: [],
  transitions: [],
};

describe("insert-generated-asset", () => {
  it("inserts an approved SRT asset onto a subtitle track and preserves provenance", () => {
    const command: TimelineCommand = {
      type: "insert-generated-asset",
      assetId: "asset-srt-1",
      generationJobId: "job-123",
      uri: "supabase://generated/job-123/counter.srt",
      mimeType: "application/x-subrip",
      mediaType: "subtitle",
      operationId: "srt-counter",
      sourceId: "raw-video-1",
      startSeconds: 2,
      endSeconds: 8,
      operationMetadata: { countTo: 600, stepSeconds: 0.1 },
    };

    const result = applyTimelineCommand(baseTimeline, command);
    const subtitleTrack = result.tracks.find((track) => track.type === "subtitle");

    expect(subtitleTrack).toBeDefined();
    expect(subtitleTrack?.locked).toBe(false);
    expect(subtitleTrack?.clips).toHaveLength(1);
    expect(subtitleTrack?.clips[0]).toMatchObject({
      assetId: "asset-srt-1",
      startSeconds: 2,
      endSeconds: 8,
      generatedRegion: {
        assetId: "asset-srt-1",
        generationJobId: "job-123",
        uri: "supabase://generated/job-123/counter.srt",
        mimeType: "application/x-subrip",
        operationId: "srt-counter",
        sourceId: "raw-video-1",
        metadata: { countTo: 600, stepSeconds: 0.1 },
      },
    });
  });

  it("reuses an existing unlocked subtitle track", () => {
    const timeline = {
      ...baseTimeline,
      tracks: [
        ...baseTimeline.tracks,
        { id: "sub-1", type: "subtitle" as const, locked: false, clips: [] },
      ],
    };

    const result = applyTimelineCommand(timeline, {
      type: "insert-generated-asset",
      assetId: "asset-srt-2",
      generationJobId: "job-456",
      uri: "file:///counter.srt",
      mimeType: "application/x-subrip",
      mediaType: "subtitle",
      operationId: "srt-counter",
      startSeconds: 0,
      endSeconds: 3,
    });

    expect(result.tracks.filter((track) => track.type === "subtitle")).toHaveLength(1);
    expect(result.tracks.find((track) => track.id === "sub-1")?.clips[0]?.assetId).toBe("asset-srt-2");
  });
});
