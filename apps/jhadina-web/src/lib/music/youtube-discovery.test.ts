import {describe,it,expect} from "vitest";
import {mapYouTubeVideos,parseYouTubePlaylistId,youtubeDiscoveryLimit,YouTubeDiscoveryError} from "./youtube-discovery";
describe("YouTube discovery provider boundaries",()=>{
 it("maps and deduplicates only valid video references",()=>{
   const sample=[
     {id:{videoId:"dQw4w9WgXcQ"},snippet:{title:"Rare freestyle",channelTitle:"Artist"}},
     {id:{videoId:"dQw4w9WgXcQ"},snippet:{title:"duplicate"}},
     {id:{videoId:"../../bad"},snippet:{title:"Injection"}},
     {id:{videoId:"kJQP7kiw5Fk"},snippet:{title:"Private video"}},
   ];
   expect(mapYouTubeVideos(sample)).toEqual([{id:"dQw4w9WgXcQ",title:"Rare freestyle",artist:"Artist",source:"youtube",thumbnail:undefined}]);
 });
 it("parses only official playlist pages",()=>{
   const id="PL1234567890abcdef";
   expect(parseYouTubePlaylistId("https://music.youtube.com/playlist?list="+id)).toBe(id);
   expect(parseYouTubePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list="+id)).toBe(id);
   expect(parseYouTubePlaylistId("https://youtube.com.evil.example/playlist?list="+id)).toBeNull();
   expect(parseYouTubePlaylistId("http://youtube.com/playlist?list="+id)).toBeNull();
   expect(parseYouTubePlaylistId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
 });
 it("fails closed after bounded per-owner usage",()=>{
   for(let i=0;i<8;i++)youtubeDiscoveryLimit("test-user-123","search",12345);
   expect(()=>youtubeDiscoveryLimit("test-user-123","search",12345)).toThrow(YouTubeDiscoveryError);
 });
});
