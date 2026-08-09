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

const primary = [
  ["🏡", "Home", "/"],
  ["💵", "Money", "/money/command-center"],
  ["🤷🏾", "Ask Jhadina", "/ask-jhadina"],
  ["🎥✊🏾", "Opportunity", "/opportunity"],
  ["📋", "Activity", "/activity"],
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
        {primary.map(([icon,name,href])=>
          <Link key={name} href={href} style={{...navLink,...(name==="Ask Jhadina"?askLink:{})}}>
            <span style={{fontSize:name==="Opportunity"?18:21}}>{icon}</span><span>{name}</span>
          </Link>
        )}
      </nav>
    </>
  )
}

const bottom={position:"fixed" as const,left:0,right:0,bottom:0,zIndex:55,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:3,padding:"7px 8px calc(7px + env(safe-area-inset-bottom))",background:"rgba(255,255,255,.94)",backdropFilter:"blur(18px)",borderTop:"1px solid #dde4df"}
const navLink={display:"grid",justifyItems:"center",gap:2,padding:"6px 1px",borderRadius:14,textDecoration:"none",color:"#34443c",fontSize:10,fontWeight:650}
const askLink={fontWeight:850,transform:"translateY(-2px) scale(1.04)",background:"rgba(52,68,60,.07)"}
const dropboxButton={border:"1px solid #d8dfda",background:"rgba(255,255,255,.94)",borderRadius:14,padding:"9px 11px",fontSize:20,boxShadow:"0 8px 24px rgba(0,0,0,.12)",cursor:"pointer"}
const dropbox={marginTop:8,minWidth:210,padding:8,borderRadius:18,background:"rgba(255,255,255,.98)",border:"1px solid #d8dfda",boxShadow:"0 18px 45px rgba(0,0,0,.16)",display:"grid",gap:4}
const worldLink={display:"flex",gap:10,alignItems:"center",padding:"10px 12px",borderRadius:12,textDecoration:"none",color:"#34443c",fontSize:14}
