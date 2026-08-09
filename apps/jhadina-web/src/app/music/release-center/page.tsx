'use client'

import { useMemo, useState } from "react"
import type { MusicPlatform } from "@/lib/music/distributionAdapter"

const platforms: { id: MusicPlatform; label: string }[] = [
  { id: "spotify", label: "Spotify" }, { id: "apple_music", label: "Apple Music" },
  { id: "youtube_music", label: "YouTube Music" }, { id: "amazon_music", label: "Amazon Music" },
  { id: "tidal", label: "Tidal" }, { id: "deezer", label: "Deezer" },
  { id: "soundcloud", label: "SoundCloud" }, { id: "youtube", label: "YouTube" },
  { id: "jhadina_music", label: "Jhadina Music" },
]

export default function ReleaseCenter() {
  const [title, setTitle] = useState(""), [artist, setArtist] = useState("Atwood Bookie"), [date, setDate] = useState(""), [audio, setAudio] = useState(""), [artwork, setArtwork] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  const [selected, setSelected] = useState<MusicPlatform[]>(["spotify", "apple_music", "youtube_music", "jhadina_music"])
  const toggle = (id: MusicPlatform) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const ready = useMemo(() => title.trim() && artist.trim() && date && audio.trim() && artwork.trim() && selected.length > 0, [title, artist, date, audio, artwork, selected])
  async function submit() {
    if (!ready) return
    setBusy(true); setMessage("")
    try {
      const r = await fetch("/api/music/releases", { method: "POST", headers: { "content-type": "application/json", "x-jhadina-user-id": "user_demo" }, body: JSON.stringify({ title, artist, releaseDate: date, audioMasterUrl: audio, artworkUrl: artwork, destinations: selected }) })
      const j = await r.json(); if (!r.ok) throw Error(j.error || "Could not create release")
      setMessage(`Release created: ${j.data?.releaseId || "ready for distribution"}`)
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not create release") } finally { setBusy(false) }
  }
  return <main style={{ minHeight:"100vh", background:"linear-gradient(180deg,#f6f1e9,#edf2ed)", color:"#29332e", padding:"30px 18px 100px", fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif' }}><div style={{maxWidth:850,margin:"0 auto"}}><div style={eyebrow}>Jhadina Music</div><h1 style={{fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(38px,9vw,62px)",letterSpacing:"-.045em",margin:"12px 0 8px"}}>Release Center</h1><p style={{color:"#718078",lineHeight:1.6,maxWidth:600}}>One release package. Your metadata, your date, your destinations, and a clear status trail.</p>
  <section style={card}><Field label="Release title" value={title} onChange={setTitle} placeholder="Single or album title"/><Field label="Artist" value={artist} onChange={setArtist} placeholder="Artist name"/><Field label="Release date" value={date} onChange={setDate} type="date"/><Field label="Master audio URL" value={audio} onChange={setAudio} placeholder="Supabase Storage URL"/><Field label="Artwork URL" value={artwork} onChange={setArtwork} placeholder="3000×3000 artwork URL"/>
  <div style={{marginTop:20}}><div style={label}>Destinations</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginTop:9}}>{platforms.map(p=><button key={p.id} onClick={()=>toggle(p.id)} style={{...pill,...(selected.includes(p.id)?selectedPill:{})}}>{selected.includes(p.id)?"✓ ":""}{p.label}</button>)}</div></div>
  <div style={{marginTop:24,padding:15,borderRadius:18,background:"#eef1ed",fontSize:13,color:"#657169"}}><strong>Distribution rule:</strong> Jhadina will submit only to the destinations you explicitly select. Each platform gets an independent status.</div>
  <button disabled={!ready||busy} onClick={submit} style={{...primary,opacity:!ready||busy?.55:1,marginTop:18}}>{busy?"Creating release…":"Create release package"}</button>{message&&<div role="status" style={{marginTop:12,padding:13,borderRadius:16,background:"#e8eee8",color:"#4e6255"}}>{message}</div>}</section></div></main>
}
function Field({label,value,onChange,placeholder,type="text"}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string}){return <label style={{display:"block",marginTop:14}}><span style={labelStyle}>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={input}/></label>}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"};const label={fontSize:12,color:"#657169"};const labelStyle={...label,display:"block",marginBottom:6};const input={width:"100%",boxSizing:"border-box" as const,padding:"13px 14px",borderRadius:16,border:"1px solid #d5ddd7",background:"rgba(255,255,255,.78)",font:"inherit",outline:"none"};const card={marginTop:25,padding:22,borderRadius:28,background:"rgba(255,255,255,.7)",border:"1px solid #dce2dd",boxShadow:"0 16px 45px rgba(67,76,69,.08)"};const pill={border:"1px solid #d5ddd7",borderRadius:999,padding:"10px 13px",background:"white",color:"#56635c",fontWeight:600,cursor:"pointer"};const selectedPill={background:"#34443c",color:"#f8f6f1",borderColor:"#34443c"};const primary={border:0,borderRadius:999,padding:"12px 19px",background:"#34443c",color:"#f8f6f1",fontWeight:700,cursor:"pointer"};
