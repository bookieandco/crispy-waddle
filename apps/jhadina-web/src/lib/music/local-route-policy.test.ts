import { describe, expect, it } from "vitest";
import { isLocalMusicPreviewRoute } from "./local-route-policy";
describe("SWLC-independent private music preview routing", () => {
  it("allows only the browser-only Local Music page in preview", () => {
    expect(isLocalMusicPreviewRoute("/music/local", "preview")).toBe(true);
    for (const env of ["production", "development", undefined]) {
      expect(isLocalMusicPreviewRoute("/music/local", env)).toBe(false);
    }
    for (const route of ["/music", "/api/music/playback", "/api/music/import", "/music/local/other", "/"]) {
      expect(isLocalMusicPreviewRoute(route, "preview")).toBe(false);
    }
  });
});
