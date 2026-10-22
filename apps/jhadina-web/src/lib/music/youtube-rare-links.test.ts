import {describe,expect,it} from "vitest";
import {parseYouTubeVideoId,cleanRareTrack,officialYouTubeUrl,visibleYouTubeEmbedUrl} from "./youtube-rare-links";

describe("YouTube rare-find URL admission",()=>{
  const id="dQw4w9WgXcQ";
  it("allows direct video links from regular and Music YouTube",()=>{
    expect(parseYouTubeVideoId("https://music.youtube.com/watch?v="+id+"&feature=share")).toBe(id);
    expect(parseYouTubeVideoId("https://youtu.be/"+id+"?si=abc")).toBe(id);
    expect(parseYouTubeVideoId("https://www.youtube.com/shorts/"+id)).toBe(id);
    expect(parseYouTubeVideoId("https://m.youtube.com/watch?v="+id)).toBe(id);
  });
  it("rejects spoofed origins, playlists, invalid ids, and unsafe schemes",()=>{
    for(const url of [
      "javascript:alert(1)","http://youtube.com/watch?v="+id,
      "https://youtube.com.evil.example/watch?v="+id,
      "https://evil.example/youtube.com/watch?v="+id,
      "https://music.youtube.com/playlist?list=PLsomething",
      "https://www.youtube.com/watch?v=%3Cscript%3E",
      "https://youtu.be/"+id+"/more",
      "https://user:pass@youtube.com/watch?v="+id
    ])expect(parseYouTubeVideoId(url)).toBeNull();
  });
  it("cleans persisted bookmarks and constructs only official player links",()=>{
    expect(cleanRareTrack({id,title:"  Rare track ",artist:" DJ ",savedAt:2})).toEqual({id,title:"Rare track",artist:"DJ",savedAt:2});
    expect(cleanRareTrack({id:"../../abc",title:"x",artist:"x",savedAt:1})).toBeNull();
    expect(officialYouTubeUrl(id)).toBe("https://www.youtube.com/watch?v="+id);
    expect(visibleYouTubeEmbedUrl(id)).toBe("https://www.youtube-nocookie.com/embed/"+id);
    expect(()=>visibleYouTubeEmbedUrl("evil")).toThrow();
  });
});
