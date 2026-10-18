"use client";
import { useEffect,useState } from "react";
import { acquireJhadinaMediaFocus, announceJhadinaYouTubePlayer, listenForOtherMediaFocus, listenForOtherYouTubePlayer } from "./media-focus";
import { cleanRareTrack, visibleYouTubeEmbedUrl, officialYouTubeUrl, type RareYouTubeTrack } from "@/lib/music/youtube-rare-links";
import type { YoutubeVideo } from "@/lib/music/youtube-discovery";
import styles from "./YouTubeDiscoveryPanel.module.css";

const KEY="jhadina.music.youtube-rare-finds.v1";
export const UPDATED_EVENT="jhadina:rare-finds-updated";
type SearchResponse={data?:{results:YoutubeVideo[]};error?:string};
type PlaylistResponse={data?:{items:YoutubeVideo[];playlistId:string;nextPageToken:string|null;total:number};error?:string};
interface Props {query?:string;}
function rareFrom(video:YoutubeVideo):RareYouTubeTrack{
 return {id:video.id,title:video.title.slice(0,160),artist:video.artist.slice(0,100),savedAt:Date.now()};
}
export function saveRareYouTubeFinds(items:YoutubeVideo[]):{added:number;existing:number;full:boolean}{
  const raw=JSON.parse(localStorage.getItem(KEY)||"[]") as unknown;
  const stored:Array<RareYouTubeTrack>=Array.isArray(raw)?raw.map(cleanRareTrack).filter((x):x is RareYouTubeTrack=>x!==null).slice(0,250):[];
  const seen=new Set(stored.map(x=>x.id));
  let added=0,existing=0,full=false;
  for(const item of items) {
    if(!/^[A-Za-z0-9_-]{11}$/.test(item.id))continue;
    if(seen.has(item.id)){existing++;continue;}
    if(stored.length>=250){full=true;break;}
    stored.unshift(rareFrom(item));seen.add(item.id);added++;
  }
  localStorage.setItem(KEY,JSON.stringify(stored));
  window.dispatchEvent(new Event(UPDATED_EVENT));
  return {added,existing,full};
}

/** User-triggered official API calls only. Remote provider results are never assumed to be licensed audio. */
export function YouTubeDiscoveryPanel({query=""}:Props){
  const [text,setText]=useState(query);
  const [mode,setMode]=useState<"search"|"playlist">("search");
  const [link,setLink]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [results,setResults]=useState<YoutubeVideo[]>([]);
  const [playlist,setPlaylist]=useState<YoutubeVideo[]>([]);
  const [pageToken,setPageToken]=useState<string|null>(null);
  const [ownerConnected,setOwnerConnected]=useState(false);
  const [publicSearchReady,setPublicSearchReady]=useState(false);
  const [oauthAvailable,setOauthAvailable]=useState(false);
  const [activePreview,setActivePreview]=useState<YoutubeVideo|null>(null);
  const [checked,setChecked]=useState(false);

  useEffect(()=>setText(query),[query]);
  useEffect(()=>{
    let live=true;
    void fetch("/api/music/youtube/status",{cache:"no-store"})
      .then(r=>r.json()).then(data=>{if(live){setOwnerConnected(data.connected===true);setPublicSearchReady(data.publicSearchAvailable===true);setOauthAvailable(data.oauthAvailable===true);}})
      .catch(()=>{if(live)setOwnerConnected(false);})
      .finally(()=>{if(live)setChecked(true);});
    return()=>{live=false;};
  },[]);
  useEffect(()=>listenForOtherMediaFocus("youtube",()=>setActivePreview(null)),[]);
  useEffect(()=>listenForOtherYouTubePlayer("discovery",()=>setActivePreview(null)),[]);
  function preview(video:YoutubeVideo){
    if(activePreview?.id===video.id){setActivePreview(null);return;}
    acquireJhadinaMediaFocus("youtube");
    announceJhadinaYouTubePlayer("discovery");
    setActivePreview(video);
  }
  function save(items:YoutubeVideo[]){
    setError(null);
    try {
      const saved=saveRareYouTubeFinds(items);
      setNotice(saved.added+" saved to Rare Finds."+(saved.existing?" "+saved.existing+" already saved.":"")+
        (saved.full?" Shelf is full (250 items).":""));
    }catch {setError("This browser cannot save Rare Finds. Check Safari storage permissions.");}
  }
  async function search(){
    const needle=text.trim();
    if(needle.length<2||needle.length>120){setError("Enter 2–120 characters.");return;}
    setLoading(true);setError(null);setNotice(null);setResults([]);setActivePreview(null);
    try {
      const res=await fetch("/api/music/youtube/search?q="+encodeURIComponent(needle),{cache:"no-store"});
      const payload=await res.json() as SearchResponse;
      if(!res.ok)throw new Error(payload.error||"YouTube search unavailable.");
      setResults(payload.data?.results||[]);
      if(!payload.data?.results?.length)setNotice("No embeddable videos found for that search.");
    }catch(e){setError(e instanceof Error?e.message:"YouTube search unavailable.");}
    finally{setLoading(false);}
  }
  async function playlistPage(next:string|null){
    if(!link.trim()){setError("Paste the playlist link first.");return;}
    setLoading(true);setError(null);setNotice(null);
    try {
      const params=new URLSearchParams({url:link.trim()});
      if(next)params.set("pageToken",next);
      const res=await fetch("/api/music/youtube/playlist?"+params.toString(),{cache:"no-store"});
      const payload=await res.json() as PlaylistResponse;
      if(!res.ok)throw new Error(payload.error||"Playlist unavailable.");
      const incoming=payload.data?.items||[];
      setPlaylist(current=>{
        const original=next?current:[];
        const seen=new Set(original.map(x=>x.id));
        return [...original,...incoming.filter(x=>!seen.has(x.id))].slice(0,250);
      });
      setPageToken(payload.data?.nextPageToken||null);
      if(!incoming.length)setNotice("No accessible tracks found on this playlist page.");
    }catch(e){setError(e instanceof Error?e.message:"Playlist unavailable.");}
    finally{setLoading(false);}
  }
  function switchMode(m:"search"|"playlist"){
    setMode(m);setError(null);setNotice(null);setActivePreview(null);
  }
  function row(video:YoutubeVideo){
    return <article key={video.id} className={styles.result}>
      {video.thumbnail?
        // Render only trusted-thumbnail URLs returned by the API mapper.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.art} src={video.thumbnail} alt="" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>:
        <span className={styles.artFallback} aria-hidden="true">♫</span>}
      <div className={styles.info}><strong>{video.title}</strong><span>{video.artist} · YouTube video</span></div>
      <button type="button" className={styles.playButton} onClick={()=>preview(video)}
         aria-label={(activePreview?.id===video.id?"Close":"Preview")+" official YouTube player for "+video.title}>
         {activePreview?.id===video.id?"Stop":"▶ Play"}
      </button>
      <a className={styles.open} href={officialYouTubeUrl(video.id)} target="_blank" rel="noopener noreferrer"
         aria-label={"Open original YouTube video for "+video.title}>↗</a>
      <button type="button" className={styles.save} onClick={()=>save([video])}>+ Save</button>
    </article>;
  }
  return <section className={styles.wrapper} aria-label="Official YouTube discovery">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Across your music worlds</p><h2>Search YouTube</h2></div>
      <span className={styles.source}>YouTube Data API</span>
    </header>
    <p className={styles.detail}>Discover rare freestyles, remixes, live performances and videos. Save links to Rare Finds. Video playback stays in the official YouTube player.</p>
    <div className={styles.tabs}>
      <button type="button" className={mode==="search"?styles.tabActive:styles.tab} onClick={()=>switchMode("search")}>Find songs</button>
      <button type="button" className={mode==="playlist"?styles.tabActive:styles.tab} onClick={()=>switchMode("playlist")}>Import playlist</button>
    </div>
    {mode==="search"?<>
      <form className={styles.search} onSubmit={e=>{e.preventDefault();void search();}}>
        <input type="search" aria-label="Search official YouTube videos" placeholder="Artist, song, underground remix…"
          value={text} maxLength={120} onChange={e=>setText(e.target.value)} />
        <button type="submit" disabled={loading||text.trim().length<2}>{loading?"Searching…":"Search"}</button>
      </form>
      {results.length>0&&<div className={styles.results}>
        <div className={styles.resultHead}><strong>{results.length} YouTube results</strong><button type="button" onClick={()=>save(results)} disabled={loading}>＋ Save all</button></div>
        {results.map(row)}
      </div>}
    </>:<>
      <form className={styles.search} onSubmit={e=>{e.preventDefault();setPlaylist([]);setPageToken(null);void playlistPage(null);}}>
        <input aria-label="YouTube or YouTube Music playlist URL" type="url" placeholder="https://music.youtube.com/playlist?list=…"
          value={link} maxLength={2048} onChange={e=>{setLink(e.target.value);setPlaylist([]);setPageToken(null);}} />
        <button type="submit" disabled={loading||!link.trim()}>{loading?"Loading…":"Preview"}</button>
      </form>
      {playlist.length>0&&<div className={styles.results}>
        <div className={styles.resultHead}><strong>{playlist.length} unique songs previewed</strong>
          <button type="button" onClick={()=>save(playlist)} disabled={loading}>＋ Save previewed songs</button></div>
        {playlist.map(row)}
        {pageToken&&<button type="button" className={styles.more} onClick={()=>void playlistPage(pageToken)} disabled={loading}>{loading?"Loading…":"Load more songs"}</button>}
      </div>}
    </>}
    {activePreview&&<div className={styles.preview} aria-label={"YouTube preview for "+activePreview.title}>
      <div className={styles.previewHeader}><div><strong>{activePreview.title}</strong><small>{activePreview.artist} · Official YouTube player</small></div>
        <button className={styles.previewClose} type="button" aria-label="Close YouTube player" onClick={()=>setActivePreview(null)}>×</button></div>
      <iframe className={styles.video} key={activePreview.id} src={visibleYouTubeEmbedUrl(activePreview.id)}
        title={"YouTube video: "+activePreview.title} loading="lazy" allowFullScreen
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"/>
      <p className={styles.previewNote}>Tap play inside the visible YouTube player. YouTube may restrict embedding or show ads. If unavailable, open the original video.</p>
      <a className={styles.previewLink} href={officialYouTubeUrl(activePreview.id)} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
    </div>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    <footer className={styles.footer}>
      <span>{!checked?"Checking discovery…":ownerConnected?"Connected YouTube account":publicSearchReady?
        "Public YouTube search available · Your private YouTube account is not connected":
        "YouTube API key or account connection required"}.
        {" "}Results play only in YouTube's official visible player.</span>
      {!ownerConnected&&oauthAvailable&&<a href="/api/auth/youtube/start" className={styles.connect}>Connect YouTube ↗</a>}
    </footer>
  </section>;
}
