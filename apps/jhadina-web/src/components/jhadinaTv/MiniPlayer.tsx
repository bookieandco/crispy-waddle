'use client'

import Link from "next/link"
import { useMediaPlayerState, useMediaPlayerStore } from "@jhadina/tv-core"

export function MiniPlayer(){
 const state=useMediaPlayerState()
 const store=useMediaPlayerStore()
 const {item,playback,target}=state
 if(!item)return null
 const playing=playback.status==='playing'
 const progress=playback.durationMs?Math.min(100,playback.positionMs/playback.durationMs*100):0
 return <div style={{position:"fixed",right:14,bottom:78,zIndex:50,width:"min(92vw,420px)",borderRadius:18,overflow:"hidden",background:"#111",boxShadow:"0 14px 45px rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.12)",color:"white"}}>
  <div style={{display:"flex",alignItems:"center",gap:10,padding:9}}>
   {item.artworkUrl&&<img src={item.artworkUrl} alt="" style={{width:58,height:42,objectFit:"cover",borderRadius:8}}/>}
   <div style={{minWidth:0,flex:1}}><strong style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</strong><span style={{fontSize:11,color:"#9da2ae"}}>{target?.name??"This device"} · {Math.floor(playback.positionMs/1000)}s</span></div>
   <button onClick={()=>playing?store.pause():store.play()} style={button}>{playing?"Pause":"Play"}</button>
   <Link href="/jhadinatv/player" style={button}>Open</Link>
  </div>
  <div style={{height:3,background:"#242832"}}><div style={{width:`${progress}%`,height:"100%",background:"#f7f7f8"}}/></div>
 </div>
}
const button={border:0,borderRadius:10,padding:"6px 9px",background:"#2b342f",color:"white",cursor:"pointer",textDecoration:"none",fontSize:12}
