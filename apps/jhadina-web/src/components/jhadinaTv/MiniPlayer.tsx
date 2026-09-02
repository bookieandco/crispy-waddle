'use client'

import { useEffect, useState } from "react"
import type { MediaPlaybackSnapshot } from "../../lib/jhadinatv/media-playback-runtime"
import { getMediaPlaybackSnapshot, subscribeMediaPlaybackSnapshot } from "../../lib/jhadinatv/media-playback-runtime"

export function MiniPlayer(){
 const [snapshot,setSnapshot]=useState<MediaPlaybackSnapshot>(()=>getMediaPlaybackSnapshot())
 const [open,setOpen]=useState(true)
 const [expanded,setExpanded]=useState(false)
 useEffect(()=>subscribeMediaPlaybackSnapshot(setSnapshot),[])
 const item=snapshot.current
 const session=snapshot.session
 useEffect(()=>{if(!item)setOpen(false);else setOpen(true)},[item])
 if(!open||!item)return null
 const playing=snapshot.playerState?.playing ?? false
 const position=Math.floor(snapshot.playerState?.positionSeconds ?? 0)
 const duration=Math.floor(snapshot.playerState?.durationSeconds ?? item.durationSeconds ?? 0)
 return <div style={{position:"fixed",right:14,bottom:78,zIndex:50,width:expanded?"min(92vw,720px)":300,borderRadius:18,overflow:"hidden",background:"#111",boxShadow:"0 14px 45px rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.12)"}}>
  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",color:"white"}}>
   <button onClick={()=>void session?.[playing?"pause":"play"]()} style={button}>{playing?"Pause":"Play"}</button>
   <button onClick={()=>void session?.seek(Math.max(0,(snapshot.playerState?.positionSeconds ?? 0)-10))} style={button}>−10s</button>
   <button onClick={()=>void session?.seek((snapshot.playerState?.positionSeconds ?? 0)+10)} style={button}>+10s</button>
   <strong style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",margin:"0 4px",flex:1}}>{item.title}</strong>
   <button onClick={()=>setExpanded(v=>!v)} style={button}>{expanded?"Min":"Expand"}</button>
   <button onClick={()=>setOpen(false)} style={button}>×</button>
  </div>
  <div style={{height:expanded?180:72,background:"#08090b",display:"grid",placeItems:"center",color:"#aaa",fontSize:expanded?28:14}}>
   <div>{position}s{duration>0?` / ${duration}s`:""}{snapshot.playerState?.target && snapshot.playerState.target.transport !== "local" ? ` • ${snapshot.playerState.target.name}` : ""}</div>
  </div>
 </div>
}
const button={border:0,borderRadius:10,padding:"5px 8px",background:"#2b342f",color:"white",cursor:"pointer"}
