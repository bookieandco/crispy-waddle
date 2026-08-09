'use client'

import { useState } from "react"
import Link from "next/link"

const worlds = [
  ["🎵", "Music", "/music"],
  ["📺", "JhadinaTV", "/jhadinatv"],
  ["🎬", "Film Generator", "/film"],
  ["📱", "Social / Growth", "/social"],
  ["🐶", "PupsonStuff", "/pupsonstuff"],
  ["🚛", "TruckerOS", "/trucker"],
] as const

export function JhadinaShellNavigation() {
  const [dropboxOpen, setDropboxOpen] = useState(false)

  return (
    <>
      <header style={{position:"fixed",top:0,right:0,zIndex:60,padding:"12px 14px"}}>
        <button aria-label="Open Jhadina worlds" aria-expanded={dropboxOpen} onClick={()=>setDropboxOpen(v=>!v)} style={dropboxButton}>📂</button>
        {dropboxOpen && <nav aria-label="Jhadina worlds" style={dropbox}>
          {worlds.map(([icon,name,href])=><Link key={name} href={href} onClick={()=>setDropboxOpen(false)} style={worldLink}><span>{icon}</span>{name}</Link>)}
        </nav>}
      </header>

      <nav aria-label="Primary navigation" style={bottom}>
        <Link href="/" style={navLink}>🏡<span>Home</span></Link>
        <Link href="/money/command-center" style={navLink}>💵<span>Money</span></Link>
        <Link href="/ask-jhadina" style={{...navLink,...askLink}}>🤷🏾<span>Ask Jhadina</span></Link>
        <Link href="/opportunity" style={navLink}>🎥✊🏾<span>Opportunity</span></Link>
      </nav>
    </>
  )
}

const bottom={position:"fixed" as const,left:0,right:0,bottom:0,zIndex:55,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,padding:"8px 10px calc(8px + env(safe-area-inset-bottom))",background:"rgba(255,255,255,.92)",backdropFilter:"blur(18px)",borderTop:"1px solid #dde4df"}
const navLink={display:"grid",justifyItems:"center",gap:3,padding:"7px 2px",borderRadius:14,textDecoration:"none",color:"#34443c",fontSize:20}
const askLink={fontWeight:800}
const dropboxButton={border:"1px solid #d8dfda",background:"rgba(255,255,255,.94)",borderRadius:14,padding:"9px 11px",fontSize:20,boxShadow:"0 8px 24px rgba(0,0,0,.12)",cursor:"pointer"}
const dropbox={marginTop:8,minWidth:210,padding:8,borderRadius:18,background:"rgba(255,255,255,.98)",border:"1px solid #d8dfda",boxShadow:"0 18px 45px rgba(0,0,0,.16)",display:"grid",gap:4}
const worldLink={display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:12,textDecoration:"none",color:"#34443c",fontSize:14}
