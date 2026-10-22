/** Only actual YouTube video URLs are playable here. We never resolve, scrape or cache audio streams. */
const VIDEO_ID=/^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input:string):string|null {
  if(!input || input.length>2048)return null;
  let url:URL;
  try { url=new URL(input.trim()); } catch {return null;}
  if(url.protocol!=="https:")return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(url.username||url.password||url.port)return null;
  let id:string|null=null;
  if(host==="youtube.com"||host==="www.youtube.com"||host==="m.youtube.com"||host==="music.youtube.com"){
    if(url.pathname==="/watch")id=url.searchParams.get("v");
    else if(/^\/(shorts|live)\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split("/")[2];
  }else if(host==="youtu.be"||host==="www.youtu.be"){
    if(/^\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split("/")[1];
  }
  return id&&VIDEO_ID.test(id)?id:null;
}

export interface RareYouTubeTrack {
  id:string;
  title:string;
  artist:string;
  savedAt:number;
}
export function cleanRareTrack(value:unknown):RareYouTubeTrack|null{
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>;
  if(typeof v.id!=="string"||!VIDEO_ID.test(v.id)||typeof v.title!=="string"||typeof v.artist!=="string")return null;
  const title=v.title.trim().slice(0,160),artist=v.artist.trim().slice(0,100);
  if(!title)return null;
  return {id:v.id,title,artist,savedAt:Number.isFinite(v.savedAt)?Number(v.savedAt):0};
}
export function officialYouTubeUrl(id:string):string {
  if(!VIDEO_ID.test(id))throw new Error("Invalid YouTube video ID");
  return "https://www.youtube.com/watch?v="+id;
}
export function visibleYouTubeEmbedUrl(id:string):string {
  if(!VIDEO_ID.test(id))throw new Error("Invalid YouTube video ID");
  return "https://www.youtube-nocookie.com/embed/"+id;
}
