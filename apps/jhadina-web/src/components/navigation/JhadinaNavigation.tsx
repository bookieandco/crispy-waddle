'use client'

import { useState } from "react"

export type JhadinaContext = "home" | "money" | "ask" | "opportunity" | "music" | "tv" | "film" | "social" | "pupsonstuff" | "trucker"

const primary = [
  ["home", "🏡", "Home"],
  ["money", "💵", "Money"],
  ["ask", "🤷🏾", "Ask Jhadina"],
  ["opportunity", "🎥✊🏾", "Opportunity"],
] as const

const worlds = [
  ["music", "🎵", "Music"],
  ["tv", "📺", "JhadinaTV"],
  ["film", "🎬", "Film Generator"],
  ["social", "📱", "Social / Growth"],
  ["pupsonstuff", "🐶", "PupsonStuff"],
  ["trucker", "🚛", "TruckerOS"],
] as const

export function JhadinaNavigation({ active="home", onNavigate }:{active?:JhadinaContext;onNavigate?:(context:JhadinaContext)=>void}) {
  const [open,setOpen] = useState(false)
  const go = (context:JhadinaContext) => { setOpen(false); onNavigate?.(context) }
  return <>
    <div style={{position:"fixed",top:16,right:16,zIndex:70}}>
      <button aria-label="Open Jhadina worlds" aria-expanded={open} onClick={()=>setOpen(v=>!v)} style={dropButton}>📂</button>
      {open && <div style={menu}>
        <div style={menuTitle}>Jhadina worlds</div>
        {worlds.map(([id,icon,label])=><button key={id} onClick={()=>go(id)} style={menuItem}><span>{icon}</span><span>{label}</span></button>)}
      </div>}
    </div>
    <nav aria-label="Jhadina primary navigation" style={bar}>
      {primary.map(([id,icon,label])=><button key={id} onClick={()=>go(id)} aria-current={active===id?"page":undefined} style={{...navButton,...(active===id?activeButton:{})}}><span style={{fontSize:22}}>{icon}</span><span>{label}</span></button>)}
    </nav>
  </>
}

const bar={position:"fixed" as const,left:10,right:10,bottom:10,zIndex:60,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,padding:7,borderRadius:24,background:"rgba(255,255,255,.9)",backdropFilter:"blur(18px)",border:"1px solid #dce2dd",boxShadow:"0 12px 40px rgba(25,35,30,.14)"}
const navButton={border:0,borderRadius:18,padding:"9px 4px",background:"transparent",color:"#59665f",display:"grid",justifyItems:"center",gap:3,fontSize:10,fontWeight:700,cursor:"pointer"}
const activeButton={background:"#e8eee8",color:"#34443c"}
const dropButton={width:44,height:44,borderRadius:15,border:"1px solid #dce2dd",background:"rgba(255,255,255,.92)",boxShadow:"0 8px 25px rgba(25,35,30,.12)",fontSize:21,cursor:"pointer"}
const menu={position:"absolute" as const,top:52,right:0,width:220,padding:8,borderRadius:20,background:"rgba(255,255,255,.96)",backdropFilter:"blur(18px)",border:"1px solid #dce2dd",boxShadow:"0 15px 45px rgba(25,35,30,.18)"}
const menuTitle={padding:"8px 10px",fontSize:10,textTransform:"uppercase" as const,letterSpacing:".14em",color:"#7a867f"}
const menuItem={width:"100%",border:0,borderRadius:13,padding:"11px 10px",background:"transparent",display:"flex",alignItems:"center",gap:10,textAlign:"left" as const,fontWeight:700,color:"#34443c",cursor:"pointer"}
