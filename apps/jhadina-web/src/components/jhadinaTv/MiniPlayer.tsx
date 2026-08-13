'use client'

import { useEffect, useState } from "react"

type Props={src?:string;title?:string;poster?:string}
export function MiniPlayer({src,title="JhadinaTV",poster}:Props){
 const [open,setOpen]=useState(true)
 const [expanded,setExpanded]=useState(false)
 useEffect(()=>{if(!src)setOpen(false)},[src])
 if(!open||!src)return null
 return <div style={{position:"fixed",right:14,bottom:78,zIndex:50,width:expanded?"min(92vw,720px)":260,borderRadius:18,overflow:"hidden",background:"#111",boxShadow:"0 14px 45px rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.12)"}}>
  <video src={src} poster={poster} controls={expanded} playsInline style={{display:"block",width:"100%",maxHeight:expanded?"60vh":150,objectFit:"cover"}} />
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",color:"white",fontSize:12}}>
   <button onClick={()=>setExpanded(v=>!v)} style={button}>{expanded?"Minimize":"Expand"}</button><strong style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",margin:"0 8px"}}>{title}</strong><button onClick={()=>setOpen(false)} style={button}>×</button>
  </div>
 </div>
}
const button={border:0,borderRadius:10,padding:"5px 8px",background:"#2b342f",color:"white",cursor:"pointer"}
