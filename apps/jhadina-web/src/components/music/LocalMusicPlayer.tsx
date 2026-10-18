"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { acquireJhadinaMediaFocus, listenForOtherMediaFocus } from "./media-focus";
import { localMusicFileError, localMusicTitle, LOCAL_MUSIC_MAX_BATCH } from "@/lib/music/local-music-rules";
import styles from "./JhadinaLocalMusic.module.css";

const DB_NAME = "jhadina-local-music-v1"; // Preserve the first usable preview's IndexedDB library.
const STORE = "audio";
const PREFS_KEY = "jhadina.localmusic.experience.v1";
const OPEN_EVENT = "jhadina:open-local-music";
type Tab = "home" | "discover" | "search" | "library";
type Repeat = "off" | "all" | "one";
type LibraryTab = "songs" | "favorites" | "playlists" | "artists";
interface StoredAudio { id: string; name: string; type: string; size: number; addedAt: number; blob: Blob; }
interface Playlist { id: string; name: string; ids: string[]; }
interface SavedPrefs { favorites: string[]; recent: string[]; counts: Record<string,number>; playlists: Playlist[]; }
const EMPTY_PREFS: SavedPrefs = { favorites: [], recent: [], counts: {}, playlists: [] };
const COLORS = [
  "linear-gradient(135deg,#b879d7,#46327c 75%)",
  "linear-gradient(135deg,#db775e,#612c60 80%)",
  "linear-gradient(135deg,#539bb2,#263c7f 80%)",
  "linear-gradient(135deg,#e0a76a,#8e455a 80%)",
  "linear-gradient(135deg,#8b9ad3,#422b6c 80%)",
  "linear-gradient(135deg,#97b379,#315752 80%)",
];
const stationColors = [
  "linear-gradient(140deg,#9458c2,#35225f)",
  "linear-gradient(140deg,#da6c83,#632359)",
  "linear-gradient(140deg,#4082a6,#1c4668)",
  "linear-gradient(140deg,#a78f53,#67404c)",
];
function initials(name: string): string { return (name.trim()[0] ?? "♪").toUpperCase(); }
function info(track: StoredAudio) {
  const base = localMusicTitle(track.name);
  const split = base.split(/\s+-\s+/);
  return { title: split.length >= 2 ? split.slice(1).join(" - ") : base, artist: split.length >= 2 ? split[0] : "Local Library" };
}
function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}
function shuffled(ids: string[]): string[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("This browser cannot store local audio."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onblocked = () => reject(new Error("Close other music tabs and reopen this one."));
    req.onerror = () => reject(req.error ?? new Error("Local music library unavailable."));
    req.onsuccess = () => resolve(req.result);
  });
}
async function readTracks(): Promise<StoredAudio[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as StoredAudio[]).sort((a,b) => b.addedAt - a.addedAt));
      req.onerror = () => reject(req.error ?? new Error("Could not read music."));
    });
  } finally { db.close(); }
}
async function transact(kind: "put"|"delete", item: StoredAudio|string) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE,"readwrite");
      if (kind === "put") tx.objectStore(STORE).put(item);
      else tx.objectStore(STORE).delete(item as string);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Storage full or unavailable."));
      tx.onabort = () => reject(tx.error ?? new Error("Storage change canceled."));
    });
  } finally { db.close(); }
}
function readPrefs(): SavedPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "null") as Partial<SavedPrefs> | null;
    if (!raw) return EMPTY_PREFS;
    return {
      favorites: Array.isArray(raw.favorites) ? raw.favorites.filter(x => typeof x === "string").slice(0, 1000) : [],
      recent: Array.isArray(raw.recent) ? raw.recent.filter(x => typeof x === "string").slice(0, 80) : [],
      counts: raw.counts && typeof raw.counts === "object" ? raw.counts : {},
      playlists: Array.isArray(raw.playlists) ? raw.playlists.filter(p => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.ids)).slice(0, 100) : [],
    };
  } catch { return EMPTY_PREFS; }
}

/** Spotify/YouTube-Music-inspired presentation, but every playable item is an owner-selected local audio file. */
export function LocalMusicPlayer() {
  const path = usePathname();
  const onMusicPage = path === "/music/local";
  const [tab, setTab] = useState<Tab>("home");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("songs");
  const [tracks, setTracks] = useState<StoredAudio[]>([]);
  const [prefs, setPrefs] = useState<SavedPrefs>(EMPTY_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<string|null>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string|null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [nowOpen, setNowOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [activePlaylist, setActivePlaylist] = useState<string|null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");
  const audio = useRef<HTMLAudioElement|null>(null);
  const selected = useRef<string|null>(null);
  const currentUrl = useRef<string|null>(null);
  const tracksRef = useRef<StoredAudio[]>([]);
  const active = useMemo(() => tracks.find(t => t.id === activeId) ?? null, [tracks,activeId]);
  const favorites = useMemo(() => new Set(prefs.favorites), [prefs.favorites]);
  const music = useMemo(() => new Map(tracks.map(t=>[t.id,t])),[tracks]);
  useEffect(() => { tracksRef.current = tracks; },[tracks]);

  useEffect(() => {
    let alive = true;
    void readTracks().then(data => { if (alive) setTracks(data); })
      .catch(e => { if (alive) setAlert(e instanceof Error ? e.message : "Local library unavailable"); })
      .finally(() => { if (alive) setLoading(false); });
    setPrefs(readPrefs());
    setPrefsReady(true);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!prefsReady) return;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    catch { setAlert("Your browser cannot save favorites and playlists. Keep original music files backed up."); }
  },[prefs,prefsReady]);
  useEffect(() => {
    const show = () => { if (path !== "/music/local") window.location.assign("/music/local"); else setAddOpen(true); };
    window.addEventListener(OPEN_EVENT,show);
    return () => window.removeEventListener(OPEN_EVENT,show);
  },[path]);
  useEffect(() => listenForOtherMediaFocus("local", () => audio.current?.pause()), []);
  useEffect(() => () => {
    audio.current?.pause();
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
  }, []);

  const play = useCallback((trackId: string, ids?: string[]) => {
    const track = tracksRef.current.find(t => t.id === trackId);
    const element = audio.current;
    if (!track || !element) return;
    setAlert(null);
    if (ids && ids.length) setQueue(ids.filter(id => tracksRef.current.some(t => t.id === id)));
    if (selected.current !== trackId) {
      element.pause();
      element.removeAttribute("src");
      element.load();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      const url = URL.createObjectURL(track.blob);
      selected.current = trackId; currentUrl.current = url;
      setActiveId(trackId); setPosition(0); setDuration(0);
      element.src = url;
      element.load();
    }
    acquireJhadinaMediaFocus("local");
    void element.play().catch(() => setAlert("Audio did not start. Tap Play again or check the file format."));
    try {
      if ("mediaSession" in navigator) {
        const {title,artist} = info(track);
        navigator.mediaSession.metadata = new MediaMetadata({title,artist,album:"Jhadina Local Music"});
      }
    } catch { /* optional Media Session */ }
  },[]);

  const skip = useCallback((direction: number, ended = false) => {
    const element = audio.current;
    if (!queue.length) { element?.pause(); return; }
    if (ended && repeat === "one" && element) {
      element.currentTime = 0;
      void element.play().catch(()=>undefined);
      return;
    }
    const index = queue.indexOf(selected.current ?? "");
    if (shuffle && direction > 0 && queue.length > 1) {
      const others = queue.filter(id => id !== selected.current);
      if (others.length) { play(others[Math.floor(Math.random()*others.length)]); return; }
    }
    const target = index + direction;
    if (target < 0 || target >= queue.length) {
      if (repeat === "all" || !ended && direction < 0) {
        play(queue[(target + queue.length) % queue.length]);
      } else element?.pause();
      return;
    }
    play(queue[target]);
  },[queue,repeat,shuffle,play]);

  useEffect(() => {
    if (!playing || !("mediaSession" in navigator)) return;
    const bindings: Array<[MediaSessionAction,MediaSessionActionHandler]> = [
      ["play", () => { if (audio.current) void audio.current.play().catch(()=>undefined); }],
      ["pause", () => audio.current?.pause()],
      ["nexttrack", () => skip(1)],
      ["previoustrack", () => skip(-1)],
    ];
    bindings.forEach(([name,fn]) => { try { navigator.mediaSession.setActionHandler(name,fn); } catch {} });
    return () => { bindings.forEach(([name]) => { try { navigator.mediaSession.setActionHandler(name,null); } catch {} }); };
  },[playing,skip]);

  async function importFiles(files: File[]) {
    if (!files.length) return;
    if (files.length > LOCAL_MUSIC_MAX_BATCH) { setAlert("Choose 20 files or fewer at a time."); return; }
    setBusy(true);
    let count = 0, fail = "";
    try {
      for(const file of files) {
        const error = localMusicFileError(file);
        if (error) { fail = error; continue; }
        try {
          await transact("put",{id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,addedAt:Date.now()+count,blob:file});
          count++;
        } catch(e) { fail = e instanceof Error ? e.message : "Audio save failed."; break; }
      }
      setTracks(await readTracks());
      setAlert(count ? count+" track"+(count===1?"":"s")+" added to your library."+(fail?" "+fail:"") : fail || "No files added.");
      if (count) setAddOpen(false);
    } catch(e) { setAlert(e instanceof Error ? e.message : "Storage failed."); }
    finally { setBusy(false); }
  }
  async function remove(track: StoredAudio) {
    if (selected.current === track.id) {
      audio.current?.pause(); audio.current?.removeAttribute("src"); audio.current?.load();
      if(currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current=null; selected.current=null; setActiveId(null); setDuration(0); setPosition(0);
    }
    try {
      await transact("delete",track.id);
      setTracks(await readTracks());
      setQueue(x=>x.filter(id=>id!==track.id));
      setPrefs(x=>({
        favorites:x.favorites.filter(id=>id!==track.id),
        recent:x.recent.filter(id=>id!==track.id),
        counts:Object.fromEntries(Object.entries(x.counts).filter(([id])=>id!==track.id)),
        playlists:x.playlists.map(p=>({...p,ids:p.ids.filter(id=>id!==track.id)})),
      }));
    } catch(e) { setAlert(e instanceof Error ? e.message : "Remove failed."); }
  }
  function toggleFavorite(id: string) {
    setPrefs(p=>({...p,favorites:p.favorites.includes(id)?p.favorites.filter(x=>x!==id):[id,...p.favorites]}));
  }
  function createPlaylist() {
    const name=playlistName.trim().slice(0,80);
    if (!name) { setAlert("Give your playlist a name."); return; }
    const id=crypto.randomUUID();
    setPrefs(p=>({...p,playlists:[...p.playlists,{id,name,ids:[]}]}));
    setActivePlaylist(id); setPlaylistName(""); setLibraryTab("playlists"); setTab("library");
  }
  function addToPlaylist(id: string,trackId: string) {
    setPrefs(p=>({...p,playlists:p.playlists.map(list=>list.id===id?{...list,ids:[...new Set([...list.ids,trackId])]}:list)}));
    setAlert("Added to playlist.");
  }
  function removeFromPlaylist(id:string,trackId:string) {
    setPrefs(p=>({...p,playlists:p.playlists.map(list=>list.id===id?{...list,ids:list.ids.filter(x=>x!==trackId)}:list)}));
  }
  const recent = useMemo(()=>prefs.recent.map(id=>music.get(id)).filter((x):x is StoredAudio=>Boolean(x)),[prefs.recent,music]);
  const trending=useMemo(()=>[...tracks].sort((a,b)=>(prefs.counts[b.id]||0)-(prefs.counts[a.id]||0)),[tracks,prefs.counts]);
  const liked=useMemo(()=>tracks.filter(t=>favorites.has(t.id)),[tracks,favorites]);
  const discoveries=useMemo(()=>tracks.filter(t=>!prefs.recent.includes(t.id)),[tracks,prefs.recent]);
  const radio=useMemo(()=>{
    const favoriteIds = liked.map(t=>t.id);
    return [
      {id:"onrepeat",title:"On Repeat",detail:"Your most played",ids:trending.map(t=>t.id),symbol:"↻",style:stationColors[0]},
      {id:"favorites",title:"Heart Radio",detail:"Songs you love",ids:favoriteIds,symbol:"♥",style:stationColors[1]},
      {id:"discovery",title:"Deep Cuts",detail:"Tracks you haven’t played",ids:discoveries.map(t=>t.id),symbol:"✦",style:stationColors[2]},
      {id:"surprise",title:"Shuffle Radio",detail:"Your entire collection",ids:shuffled(tracks.map(t=>t.id)),symbol:"◈",style:stationColors[3]},
    ];
  },[trending,liked,discoveries,tracks]);
  const allArtists=useMemo(()=>{
    const counts=new Map<string,number>();
    tracks.forEach(t=>{const a=info(t).artist;counts.set(a,(counts.get(a)||0)+1);});
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  },[tracks]);
  const searchResults=useMemo(()=>{
    const needle=query.toLocaleLowerCase().trim();
    if(!needle) return tracks;
    return tracks.filter(t=>{const {title,artist}=info(t);return (title+" "+artist+" "+t.name).toLocaleLowerCase().includes(needle);});
  },[tracks,query]);
  const currentList=queue.length?queue.map(id=>music.get(id)).filter((x):x is StoredAudio=>Boolean(x)):[...tracks];
  const activePlaylistData=prefs.playlists.find(p=>p.id===activePlaylist);
  const favoriteIds=liked.map(t=>t.id);
  function playList(ids:string[],start?:string) {
    const list=ids.filter(id=>music.has(id));
    if(!list.length) { setAlert("Add some music to your library first.");setAddOpen(true);return; }
    const order=shuffle?shuffled(list):list;
    play(start??order[0],order);
  }
  function row(track: StoredAudio, compact=false, playlistId?:string) {
    const {title,artist}=info(track);
    const col=COLORS[tracks.indexOf(track)%COLORS.length] || COLORS[0];
    return <div key={track.id} className={compact?styles.quickRow:styles.trackRow}>
      <div className={compact?styles.square:styles.trackCover} style={{background:col}} aria-hidden="true">{initials(title)}</div>
      <button type="button" className={compact?styles.quickText:styles.trackButton}
        onClick={()=>play(track.id,queue.includes(track.id)?undefined:tracks.map(t=>t.id))} aria-label={"Play "+title}>
        <strong>{title}</strong><span>{artist}</span>
      </button>
      {!compact && <button type="button" className={styles.iconButton+" "+(favorites.has(track.id)?styles.iconButtonActive:"")} aria-label={(favorites.has(track.id)?"Unlike ":"Like ")+title}
        onClick={()=>toggleFavorite(track.id)}>{favorites.has(track.id)?"♥":"♡"}</button>}
      {playlistId && <button className={styles.iconButton} type="button" onClick={()=>removeFromPlaylist(playlistId,track.id)} aria-label={"Remove "+title+" from playlist"}>×</button>}
      <button className={compact?styles.tinyPlay:styles.iconButton} type="button" aria-label={"Play "+title} onClick={()=>play(track.id,tracks.map(t=>t.id))}>▶</button>
    </div>;
  }
  function stationCard(station: typeof radio[number],index:number) {
    return <button type="button" key={station.id} className={styles.mixCard} onClick={()=>playList(station.ids)} aria-label={"Play "+station.title}>
      <div className={styles.cover} style={{background:station.style}}>
        <span className={styles.coverGraphic} aria-hidden="true">{station.symbol}</span>
        <span className={styles.coverText}>{station.title}</span>
        <span className={styles.coverDot} aria-hidden="true">▶</span>
      </div>
      <p className={styles.mixTitle}>{station.title}</p>
      <p className={styles.mixMeta}>{station.ids.length?station.detail:"Add songs to unlock"}</p>
    </button>;
  }
  function importButton(label="Add music") {
    return <button className={styles.action} type="button" onClick={()=>setAddOpen(true)}>{label}</button>;
  }
  function selectTab(next:Tab) {setTab(next);setAlert(null);}
  const progress = duration > 0 ? Math.min(100,(position/duration)*100):0;

  return <>
    <audio ref={audio} preload="metadata" playsInline
      onLoadedMetadata={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0)}
      onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)}
      onPlay={()=>{
        acquireJhadinaMediaFocus("local");setPlaying(true);
        const id=selected.current;
        if(id) setPrefs(p=>({...p,recent:[id,...p.recent.filter(x=>x!==id)].slice(0,70),counts:{...p.counts,[id]:Math.min(99999,(p.counts[id]||0)+1)}}));
      }}
      onPause={()=>setPlaying(false)} onEnded={()=>skip(1,true)}
      onError={()=>setAlert("This format cannot be played on this device. Try an MP3 or M4A.")} />
    {onMusicPage && <main className={styles.app}>
      <div className={styles.bgGlow} />
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}><span className={styles.mark}>♪</span><div>Jhadina<span className={styles.brandSub}>Music</span></div></div>
          <div className={styles.headerRight}>
            <span className={styles.pill}>◉ Private library</span>
            <button type="button" className={styles.profile} aria-label="Add music" onClick={()=>setAddOpen(true)}>+</button>
          </div>
        </header>
        {alert && <div className={styles.status} role="status">{alert} <button type="button" onClick={()=>setAlert(null)} aria-label="Dismiss message" className={styles.iconButton}>×</button></div>}
        <div className={styles.content}>
          {tab==="home" && <>
            <div className={styles.chips}>
              {(["All","Radio","Playlists","Favorites"] as const).map(item=><button key={item} className={styles.chip+" "+(item==="All"?styles.chipActive:"")} type="button" onClick={()=>{
                if(item==="Radio")setTab("discover");
                else if(item==="Favorites"){setLibraryTab("favorites");setTab("library");}
                else if(item==="Playlists"){setLibraryTab("playlists");setTab("library");}
              }}>{item}</button>)}
            </div>
            <p className={styles.eyebrow}>Your soundtrack, your rules</p>
            <h1 className={styles.title}>Listen your way.</h1>
            <section className={styles.hero}>
              <div><p className={styles.eyebrow} style={{color:"#e4caff"}}>MADE FOR YOU</p>
                <h2 className={styles.heroTitle}>Your daily<br/>rotation.</h2>
                <p className={styles.heroText}>Your favorites, repeats, and forgotten gems. A station that grows with your library.</p>
                <button type="button" className={styles.action} onClick={()=>playList((trending.length?trending:tracks).map(t=>t.id))}>▶ Play my mix</button>
              </div>
              <div className={styles.heroArt} aria-hidden="true"><div className={styles.heroRecord}><span className={styles.heroLabel}>J</span></div></div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>Quick picks</h2><button type="button" className={styles.subLink} onClick={()=>selectTab("library")}>Your library →</button></div>
              {tracks.length?<div className={styles.songGrid}>{(recent.length?recent:tracks).slice(0,6).map(t=>row(t,true))}</div>:
                <div className={styles.empty}><h3>Your music starts here.</h3>Pick files from your iPhone and you will see them in this home feed, stations and library.<div style={{marginTop:14}}>{importButton("＋ Add your first songs")}</div></div>}
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>Stations for you</h2><button type="button" className={styles.subLink} onClick={()=>selectTab("discover")}>See all →</button></div>
              <div className={styles.scrollRow}>{radio.map(stationCard)}</div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>Jump back in</h2><button type="button" className={styles.subLink} onClick={()=>selectTab("library")}>See all →</button></div>
              {recent.length?<div className={styles.trackList}>{recent.slice(0,5).map(t=>row(t))}</div>:
                <div className={styles.empty}>Your recently played songs show up here as soon as you listen.</div>}
            </section>
          </>}
          {tab==="discover" && <>
            <p className={styles.eyebrow}>Jhadina radio</p><h1 className={styles.title}>Find your next vibe.</h1>
            <p className={styles.hint} style={{marginBottom:20}}>Pandora-style stations made from your own music. Stations play continuously and adapt as you like or replay songs.</p>
            <div className={styles.scrollRow} style={{marginBottom:30}}>{radio.map(stationCard)}</div>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>Fresh in your library</h2></div>
              {tracks.length?<div className={styles.trackList}>{tracks.slice(0,12).map(t=>row(t))}</div>:
                <div className={styles.empty}>No new arrivals yet. {importButton("Add tracks")}</div>}
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>Connect the wider world</h2></div>
              {[
                ["YouTube Music","Taste, videos & listening history","Not connected to QuickPlay"],
                ["Spotify","Playlists & saved library metadata","Requires authorized connection"],
                ["Pandora-style radio","Personal stations from your collection","Local station engine active"],
              ].map(([name,description,status])=><button key={name} type="button" className={styles.panel} style={{width:"100%",display:"flex",gap:12,alignItems:"center",textAlign:"left",color:"white"}}
                onClick={()=>setAlert(name==="Pandora-style radio"?"Use the stations above; they play your local songs.":name+" is a planned provider connection, not a licensed stream in this preview.")}>
                <span className={styles.playlistBadge}>{name[0]}</span>
                <span style={{flex:1}}><strong style={{display:"block",fontSize:14}}>{name}</strong><small style={{color:"#a99db5",display:"block",marginTop:4}}>{description}</small><small style={{color:"#d7fb89",display:"block",marginTop:5}}>{status}</small></span><span>›</span>
              </button>)}
            </section>
          </>}
          {tab==="search" && <>
            <p className={styles.eyebrow}>Find your sound</p><h1 className={styles.title}>Search Jhadina.</h1>
            <label className={styles.searchBox}><span aria-hidden="true">⌕</span>
              <input aria-label="Search songs and artists" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Songs, artists, playlists…" type="search"/>
            </label>
            <div className={styles.sectionHeading}><h2>{query?"Results":"All your tracks"}</h2><span className={styles.hint}>{searchResults.length} songs</span></div>
            {searchResults.length?<div className={styles.trackList}>{searchResults.map(t=>row(t))}</div>:
              <div className={styles.empty}>{tracks.length?"No matches in your local library.":"Add music to start searching."} <div style={{marginTop:10}}>{importButton()}</div></div>}
          </>}
          {tab==="library" && <>
            <p className={styles.eyebrow}>Collected in one place</p><h1 className={styles.title}>Your library.</h1>
            <div className={styles.libraryFilters}>
              {(["songs","favorites","playlists","artists"] as const).map(value=><button key={value} type="button" className={styles.libraryFilter+" "+(libraryTab===value?styles.filterActive:"")} onClick={()=>{setLibraryTab(value);setActivePlaylist(null);}}>{value==="songs"?"Songs":value==="favorites"?"Liked":value==="playlists"?"Playlists":"Artists"}</button>)}
            </div>
            {libraryTab==="songs" && <><div className={styles.sectionHeading}><h2>{tracks.length} saved songs</h2>{importButton("＋ Add")}</div>
              {tracks.length?<div className={styles.trackList}>{tracks.map(t=>row(t))}</div>:<div className={styles.empty}>Start with music from Files. {importButton()}</div>}</>}
            {libraryTab==="favorites" && <><div className={styles.sectionHeading}><h2>Liked songs</h2><button className={styles.subLink} type="button" onClick={()=>playList(favoriteIds)}>▶ Play all</button></div>
              {liked.length?<div className={styles.trackList}>{liked.map(t=>row(t))}</div>:<div className={styles.empty}>Tap ♡ beside a song to add it here.</div>}</>}
            {libraryTab==="artists" && <><div className={styles.sectionHeading}><h2>Artists</h2></div>{allArtists.map(([artist,count],i)=>{
              const ids=tracks.filter(t=>info(t).artist===artist).map(t=>t.id);
              return <button key={artist} className={styles.playlistRow} style={{width:"100%",color:"white",textAlign:"left"}} type="button" onClick={()=>playList(ids)}>
                <span className={styles.playlistBadge} style={{background:COLORS[i%COLORS.length]}}>{initials(artist)}</span>
                <strong>{artist}</strong><span>{count} songs · ▶</span>
              </button>;
            })}{!allArtists.length&&<div className={styles.empty}>Artists appear here when you add music. Name files like <strong>Artist - Song.mp3</strong> to identify them.</div>}</>}
            {libraryTab==="playlists" && <>
              <div className={styles.panel}><h3>New playlist</h3><div className={styles.formRow}><input className={styles.textField} maxLength={80} value={playlistName} onChange={e=>setPlaylistName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")createPlaylist();}} placeholder="Give your mix a name"/>
                <button className={styles.miniAction} type="button" onClick={createPlaylist}>Create</button></div></div>
              {activePlaylistData?<section className={styles.section}>
                <div className={styles.sectionHeading}><h2>{activePlaylistData.name}</h2><button type="button" className={styles.subLink} onClick={()=>setActivePlaylist(null)}>← All</button></div>
                <button type="button" className={styles.action} onClick={()=>playList(activePlaylistData.ids)} style={{marginBottom:15}}>▶ Play playlist</button>
                <div className={styles.trackList}>{activePlaylistData.ids.map(id=>music.get(id)).filter((t):t is StoredAudio=>!!t).map(t=>row(t,false,activePlaylistData.id))}</div>
                {!activePlaylistData.ids.length&&<div className={styles.empty}>Play a track, open Now Playing, and add it to this playlist.</div>}
              </section>:prefs.playlists.length?<div>{prefs.playlists.map((list,i)=><div className={styles.playlistRow} key={list.id}>
                <span className={styles.playlistBadge} style={{background:COLORS[i%COLORS.length]}}>♫</span>
                <button className={styles.trackButton} type="button" onClick={()=>setActivePlaylist(list.id)}><strong>{list.name}</strong><span>{list.ids.length} songs</span></button>
                <button type="button" className={styles.iconButton} onClick={()=>playList(list.ids)} aria-label={"Play "+list.name}>▶</button>
              </div>)}</div>:<div className={styles.empty}>Mixes, road-trip queues and your own collections live here.</div>}
            </>}
          </>}
        </div>
        <p className={styles.support}>QuickPlay streams only files you selected on this device. Your saved files stay in this browser; iOS can clear browser storage. Cloud YouTube Music, Spotify and Pandora catalogs need separate authorized connections and playback rights.</p>
      </div>
      <nav className={styles.bottomNav} aria-label="Jhadina Music">
        {([["home","⌂","Home"],["discover","◈","Discover"],["search","⌕","Search"],["library","▤","Library"]] as const).map(([id,icon,label])=><button type="button" key={id} onClick={()=>selectTab(id)} aria-current={tab===id?"page":undefined}
          className={styles.navItem+" "+(tab===id?styles.navActive:"")}><span aria-hidden="true">{icon}</span><span>{label}</span></button>)}
      </nav>
    </main>}
    {active && onMusicPage && !nowOpen && <div className={styles.miniPlayer}>
      <span className={styles.miniCover} style={{background:COLORS[Math.max(0,tracks.indexOf(active))%COLORS.length]}}>{initials(info(active).title)}</span>
      <button type="button" onClick={()=>setNowOpen(true)} className={styles.miniInfo} aria-label="Open now playing"><strong>{info(active).title}</strong><span>{info(active).artist}</span></button>
      <button type="button" className={styles.iconButton} aria-label={favorites.has(active.id)?"Unlike":"Like"} onClick={()=>toggleFavorite(active.id)}>{favorites.has(active.id)?"♥":"♡"}</button>
      <button type="button" className={styles.iconButton} aria-label={playing?"Pause":"Play"} onClick={()=>{if(!audio.current)return; if(playing)audio.current.pause();else void audio.current.play().catch(()=>setAlert("Tap again to resume audio."));}}>{playing?"Ⅱ":"▶"}</button>
      <div className={styles.miniProgress} style={{width:progress+"%"}}/>
    </div>}
    {onMusicPage && nowOpen && active && <div className={styles.sheetBackdrop} role="presentation" onClick={()=>setNowOpen(false)}>
      <section role="dialog" aria-label="Now Playing" aria-modal="true" className={styles.now} onClick={e=>e.stopPropagation()}>
        <div className={styles.nowHeader}><button type="button" className={styles.iconButton} onClick={()=>setNowOpen(false)} aria-label="Close now playing">⌄</button><small>NOW PLAYING · LOCAL</small><button type="button" className={styles.iconButton} onClick={()=>setQueueOpen(true)} aria-label="View queue">≡</button></div>
        <div className={styles.nowCover} style={{background:COLORS[Math.max(0,tracks.indexOf(active))%COLORS.length]}}>{initials(info(active).title)}</div>
        <h2 className={styles.nowName}>{info(active).title}</h2><p className={styles.nowArtist}>{info(active).artist}</p>
        <input className={styles.scrub} type="range" aria-label="Seek track" min={0} max={Math.max(1,duration)} step={1} value={Math.min(position,Math.max(1,duration))}
          onChange={e=>{if(audio.current && duration>0){audio.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}} disabled={!duration} />
        <div className={styles.times}><span>{fmt(position)}</span><span>{fmt(duration)}</span></div>
        <div className={styles.controls}>
          <button type="button" className={styles.control+" "+(shuffle?styles.controlActive:"")} aria-label="Toggle shuffle" aria-pressed={shuffle} onClick={()=>setShuffle(x=>!x)}>⤨</button>
          <button type="button" className={styles.control} aria-label="Previous" onClick={()=>{if(audio.current && audio.current.currentTime>5){audio.current.currentTime=0;}else skip(-1);}}>◀◀</button>
          <button type="button" className={styles.bigPlay} aria-label={playing?"Pause":"Play"} onClick={()=>{if(!audio.current)return;if(playing)audio.current.pause();else void audio.current.play().catch(()=>setAlert("Unable to resume."));}}>{playing?"Ⅱ":"▶"}</button>
          <button type="button" className={styles.control} aria-label="Next" onClick={()=>skip(1)}>▶▶</button>
          <button type="button" className={styles.control+" "+(repeat!=="off"?styles.controlActive:"")} aria-label={"Repeat "+repeat} onClick={()=>setRepeat(r=>r==="off"?"all":r==="all"?"one":"off")}>{repeat==="one"?"ↂ":"↻"}</button>
        </div>
        <div className={styles.secondaryControls}>
          <button type="button" className={styles.iconButton+" "+(favorites.has(active.id)?styles.iconButtonActive:"")} onClick={()=>toggleFavorite(active.id)} aria-label="Toggle like">{favorites.has(active.id)?"♥":"♡"}</button>
          <span className={styles.hint}>Listen on iPhone · Control Center for AirPlay</span>
          <button type="button" className={styles.iconButton} onClick={()=>setQueueOpen(true)} aria-label="Open Up Next">☷</button>
        </div>
        {!!prefs.playlists.length && <label className={styles.hint}>Add this song to a playlist
          <select className={styles.textField} defaultValue="" key={active.id} aria-label="Add to playlist" onChange={e=>{if(e.target.value)addToPlaylist(e.target.value,active.id); e.target.value="";}}>
            <option value="">Choose playlist…</option>{prefs.playlists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>}
      </section>
    </div>}
    {onMusicPage && queueOpen && <div className={styles.sheetBackdrop} role="presentation" onClick={()=>setQueueOpen(false)}>
      <section role="dialog" aria-label="Up Next" aria-modal="true" className={styles.queueModal} onClick={e=>e.stopPropagation()}>
        <div className={styles.sectionHeading}><h2>Up Next</h2><button className={styles.iconButton} type="button" onClick={()=>setQueueOpen(false)} aria-label="Close queue">×</button></div>
        <p className={styles.hint}>{currentList.length} songs · {repeat==="all"?"Continuous play":repeat==="one"?"Repeat song":"Stop at end"}</p>
        <div className={styles.queueScroll}>{currentList.map(t=>row(t))}</div>
      </section>
    </div>}
    {onMusicPage && addOpen && <div className={styles.sheetBackdrop} role="presentation" onClick={()=>setAddOpen(false)}>
      <section role="dialog" aria-label="Add Music" aria-modal="true" className={styles.queueModal} onClick={e=>e.stopPropagation()}>
        <div className={styles.sectionHeading}><h2>Add to your library</h2><button type="button" className={styles.iconButton} onClick={()=>setAddOpen(false)} aria-label="Close import">×</button></div>
        <div className={styles.panel}><h3>Choose audio from Files</h3><p>MP3, M4A, WAV, AAC and supported audio. Up to 20 files per batch, 100 MB each. Nothing uploads to a server.</p>
          <input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg" multiple disabled={busy} className={styles.fileInput} style={{marginTop:14}}
            onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value="";void importFiles(files);}} />
        </div>
        <div className={styles.panel}><h3>Keep your music safe</h3><p>These files are saved to this iPhone browser’s IndexedDB, not to Jhadina’s cloud. Keep originals in Files, iCloud or Drive in case Safari clears local storage.</p></div>
        {tracks.length>0&&<div className={styles.queueScroll}><p className={styles.hint}>To remove an individual song, open Library → Songs.</p>
          {tracks.slice(0,30).map(t=><div key={t.id} className={styles.playlistRow}>
            <span className={styles.playlistBadge}>{initials(info(t).title)}</span><span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12}}>{info(t).title}</span>
            <button type="button" className={styles.confirm} onClick={()=>void remove(t)} aria-label={"Delete "+t.name}>Remove</button>
          </div>)}
        </div>}
      </section>
    </div>}
  </>;
}
