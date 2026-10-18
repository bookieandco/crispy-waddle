"use client";

import { useEffect, useState } from "react";
import { acquireJhadinaMediaFocus, listenForOtherMediaFocus } from "./media-focus";
import {
  cleanRareTrack, officialYouTubeUrl, parseYouTubeVideoId,
  visibleYouTubeEmbedUrl, type RareYouTubeTrack,
} from "@/lib/music/youtube-rare-links";
import styles from "./RareYouTubeShelf.module.css";

const STORAGE_KEY="jhadina.music.youtube-rare-finds.v1";
const UPDATED_EVENT="jhadina:rare-finds-updated";

/** Owner-curated bookmarks with a visible official YouTube player; never an audio downloader. */
export function RareYouTubeShelf() {
  const [links,setLinks]=useState<RareYouTubeTrack[]>([]);
  const [ready,setReady]=useState(false);
  const [url,setUrl]=useState("");
  const [title,setTitle]=useState("");
  const [artist,setArtist]=useState("");
  const [active,setActive]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  useEffect(()=>{
    try {
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]") as unknown;
      setLinks(Array.isArray(raw)?raw.map(cleanRareTrack).filter((x):x is RareYouTubeTrack=>x!==null).slice(0,250):[]);
    } catch {setMessage("Saved Rare Finds are unavailable in this browser.");}
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!ready)return;
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(links));}
    catch {setMessage("Safari could not save your bookmarks. Keep a separate copy of important links.");}
  },[links,ready]);
  useEffect(()=>{
    const refresh=()=>{
      try {const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]") as unknown;
        setLinks(Array.isArray(raw)?raw.map(cleanRareTrack).filter((x):x is RareYouTubeTrack=>x!==null).slice(0,250):[]);
      }catch{setMessage("Could not reload Rare Finds.");}
    };
    window.addEventListener(UPDATED_EVENT,refresh);
    return()=>window.removeEventListener(UPDATED_EVENT,refresh);
  },[]);
  useEffect(()=>listenForOtherMediaFocus("youtube",()=>setActive(null)),[]);

  function add() {
    const id=parseYouTubeVideoId(url);
    if(!id){setMessage("Paste a full YouTube or YouTube Music video link, not a playlist or search URL.");return;}
    const name=title.trim().slice(0,160);
    const by=artist.trim().slice(0,100);
    if(!name){setMessage("Enter the song or video name so you can recognize it later.");return;}
    if(links.some(item=>item.id===id)){setMessage("That YouTube video is already in Rare Finds.");return;}
    if(links.length>=250){setMessage("The 250-link private shelf is full. Remove a bookmark before adding another.");return;}
    setLinks(previous=>[{id,title:name,artist:by,savedAt:Date.now()},...previous]);
    setUrl("");setTitle("");setArtist("");setMessage("Saved to Rare Finds on this browser.");
  }

  function select(id:string) {
    if(active===id){setActive(null);return;}
    acquireJhadinaMediaFocus("youtube");
    setActive(id);
  }
  const selected=links.find(track=>track.id===active);
  return <section className={styles.wrap} id="jhadina-rare-finds" aria-label="Rare YouTube finds">
    <div className={styles.header}>
      <div><p className={styles.eyebrow}>Your underground collection</p><h2 className={styles.heading}>Rare Finds</h2></div>
      <span className={styles.label}>YouTube + YouTube Music</span>
    </div>
    <p className={styles.intro}>
      Freestyles, deep cuts, rare remixes, concert recordings. Save the original video link here and play it
      through the visible YouTube player when embedding is permitted. No audio is extracted or downloaded.
    </p>
    <form className={styles.form} onSubmit={event=>{event.preventDefault();add();}}>
      <input className={styles.full} type="url" value={url} onChange={event=>setUrl(event.target.value)}
        placeholder="Paste YouTube Music or YouTube video URL" aria-label="YouTube video link" required maxLength={2048}/>
      <input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Song / video name"
        aria-label="Name this song" maxLength={160} required/>
      <input value={artist} onChange={event=>setArtist(event.target.value)} placeholder="Artist (optional)"
        aria-label="Artist name" maxLength={100}/>
      <button className={styles.add+" "+styles.full} type="submit">＋ Save rare track</button>
    </form>
    {message&&<p className={styles.status} role="status">{message}</p>}
    {!links.length&&<p className={styles.note}>No rare tracks saved yet. Paste a video link to build your own collection.</p>}
    <div className={styles.list}>
      {links.map(track=><div key={track.id} className={styles.item}>
        <span className={styles.art} aria-hidden="true">▶</span>
        <div className={styles.text}><strong>{track.title}</strong><small>{track.artist||"YouTube recording"} · Saved link</small></div>
        <button type="button" className={styles.action} onClick={()=>select(track.id)}
          aria-label={"Open official YouTube player for "+track.title}>Play</button>
        <button type="button" className={styles.remove} onClick={()=>{
          setLinks(prev=>prev.filter(item=>item.id!==track.id));
          if(active===track.id)setActive(null);
        }} aria-label={"Remove "+track.title}>×</button>
      </div>)}
    </div>
    {selected&&<div className={styles.player}>
      <div className={styles.playerHead}>
        <strong>{selected.title}</strong>
        <button type="button" onClick={()=>setActive(null)} className={styles.remove} aria-label="Close YouTube video">×</button>
      </div>
      <iframe key={selected.id} className={styles.video} title={"YouTube player: "+selected.title}
        src={visibleYouTubeEmbedUrl(selected.id)} loading="lazy" allowFullScreen
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"/>
      <p className={styles.note}>Official YouTube player. Ads and platform restrictions may apply. Keep the video visible during playback.</p>
      <a className={styles.link} href={officialYouTubeUrl(selected.id)} target="_blank" rel="noopener noreferrer"
        onClick={()=>{acquireJhadinaMediaFocus("youtube");setActive(null);}}>Open original in YouTube ↗</a>
    </div>}
    <p className={styles.note}>
      Private bookmarks are stored on this device, not synced between phones. This is not a licensed audio copy
      or an offline download. The uploader may remove or restrict any video.
    </p>
  </section>;
}
