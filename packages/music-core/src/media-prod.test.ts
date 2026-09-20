import { describe, expect, it } from "vitest";
import { musicCheckpoint } from "./playback-checkpoint.js";
import { MemoryPlaybackHost } from "./playback-host.js";

describe("MEDIA-PROD music continuity",()=>{
 it("marks playback complete only at the resume completion threshold",()=>{ expect(musicCheckpoint("u","t",949,1000).completed).toBe(false); expect(musicCheckpoint("u","t",950,1000).completed).toBe(true); });
 it("clamps negative checkpoint positions",()=>{ expect(musicCheckpoint("u","t",-10).positionMs).toBe(0); });
 it("requires a loaded asset before playback",async()=>{ const host=new MemoryPlaybackHost(); await expect(host.play()).rejects.toThrow(); });
});
