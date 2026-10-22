import { describe,it,expect,vi,afterEach } from "vitest";
import { youtubeDiscoveryLimit,parseYouTubePlaylistId,mapYouTubeVideos } from "./youtube-discovery";
describe("discovery source separation",()=>{
  afterEach(()=>vi.restoreAllMocks());
  it("cannot treat a non-video playlist entry as playable audio",()=>{
    expect(mapYouTubeVideos([{snippet:{title:"No video",channelTitle:"uploader"}}])).toEqual([]);
  });
  it("keeps playlist URLs on real YouTube domains and rejects auth bypass URLs",()=>{
    const id="PL1234567890abcdef";
    expect(parseYouTubePlaylistId("https://music.youtube.com/playlist?list="+id)).toBe(id);
    expect(parseYouTubePlaylistId("https://evil.example/playlist?list="+id)).toBeNull();
  });
  it("separates per-owner and per-operation rate accounting",()=>{
    expect(()=>youtubeDiscoveryLimit("owner-b","search",998877)).not.toThrow();
    expect(()=>youtubeDiscoveryLimit("owner-b","playlist",998877)).not.toThrow();
  });
});
