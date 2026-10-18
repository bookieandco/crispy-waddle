import { describe, expect, it } from "vitest";
import { playbackTicketNeedsRefresh, validatePlaybackAsset } from "./playback-ticket.js";
import type { MediaAsset, MusicSource } from "./types.js";
const source: MusicSource = { id: "owned", userId: "alice", kind: "local", name: "Owned", authorized: true, metadata: { rightsBasis: "owned-master" } };
const asset: MediaAsset = { id: "a", trackId: "t", sourceId: "owned", kind: "file", uri: "https://music.example.test/stream.mp3", provenance: { playbackAuthorized: true } };
describe("scoped playback tickets", () => {
  it("rejects revoked, user-mismatched, metadata-only and tampered assets", () => {
    expect(validatePlaybackAsset("bob", "t", [source], asset)).toBeNull();
    expect(validatePlaybackAsset("alice", "other", [source], asset)).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [{ ...source, authorized: false }], asset)).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [{ ...source, metadata: { role: "catalog-library" } }], asset)).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [source], { ...asset, kind: "external_reference" })).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [source], { ...asset, uri: "http://music.example.test/a.mp3" })).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [source], { ...asset, uri: "https://127.0.0.1/a.mp3" })).toBeNull();
    expect(validatePlaybackAsset("alice", "t", [source], { ...asset, uri: "https://music.example.test/a.mp3?token=abc" })).toBeNull();
  });
  it("requires usable signed URL expiry and informs proactive renewal", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const ticket = validatePlaybackAsset("alice", "t", [source], {
      ...asset, uri: "https://music.example.test/a.mp3?token=abc",
      provenance: { playbackAuthorized: true, expiresAt: "2026-10-09T12:02:00Z" },
    }, now);
    expect(ticket?.expiresAt).toBe("2026-10-09T12:02:00Z");
    expect(playbackTicketNeedsRefresh(ticket!, now)).toBe(false);
    expect(playbackTicketNeedsRefresh(ticket!, now + 65000)).toBe(true);
    expect(validatePlaybackAsset("alice", "t", [source], { ...asset, provenance: { playbackAuthorized: true, expiresAt: "2026-10-09T12:00:09Z" } }, now)).toBeNull();
    expect(playbackTicketNeedsRefresh({ trackId: "t", sourceId: "owned", sourceUri: asset.uri }, now)).toBe(false);
  });
});
