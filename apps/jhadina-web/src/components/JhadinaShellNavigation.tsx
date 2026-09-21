'use client'

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "./JhadinaShellNavigation.module.css"

type IconName="home"|"ask"|"work"|"activity"|"more"|"money"|"media"|"growth"|"opportunity"|"spatial"|"calendar"|"campaign"|"placement"|"wallet"|"privacy"|"studio"

const primary=[
 ["home","Home","/"],
 ["ask","Ask","/ask-jhadina"],
 ["work","Work","/work"],
 ["activity","Activity","/activity"],
] as const

const worlds=[
 ["money","Money","/money/command-center"],
 ["wallet","Wallet","/wallet"],
 ["media","Music","/music"],
 ["media","JhadinaTV","/jhadinatv"],
 ["studio","Director Workstation","/workstation"],
 ["growth","Growth","/growth"],
 ["opportunity","Opportunities","/opportunity"],
 ["spatial","Spatial","/spatial"],
 ["calendar","Calendar","/calendar"],
 ["campaign","Campaign Polls","/campaign/polls"],
 ["placement","Placement","/placement/worker/opportunities"],
 ["privacy","Privacy","/settings/privacy"],
] as const

function Icon({name}:{name:IconName}){
 const common={width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true}
 if(name==="home")return <svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>
 if(name==="ask")return <svg {...common}><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></svg>
 if(name==="activity")return <svg {...common}><path d="M4 18V6"/><path d="M8 15v-5"/><path d="M12 20V4"/><path d="M16 14V8"/><path d="M20 17V7"/></svg>
 if(name==="more")return <svg {...common}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>
 if(name==="work"||name==="studio")return <svg {...common}><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/><path d="M4 12h16"/></svg>
 if(name==="money")return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.6-.7-1.4-1-2.5-1-1.3 0-2.2.6-2.2 1.6 0 2.5 4.7 1 4.7 3.8 0 1.1-1 1.9-2.5 1.9-1.2 0-2.2-.4-2.9-1.2"/><path d="M12 6.5v11"/></svg>
 if(name==="media")return <svg {...common}><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>
 if(name==="growth")return <svg {...common}><path d="M4 18 10 12l4 3 6-8"/><path d="M15 7h5v5"/></svg>
 if(name==="opportunity")return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4V2M12 22v-2M4 12H2M22 12h-2"/></svg>
 if(name==="spatial")return <svg {...common}><path d="M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
 if(name==="calendar")return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
 if(name==="campaign")return <svg {...common}><path d="M5 19V9l7-4 7 4v10"/><path d="M3 19h18M9 19v-5h6v5"/></svg>
 if(name==="placement")return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-4 2.4-6 5.5-6s4.9 2 5.5 6"/><path d="m16 11 2 2 3-4"/></svg>
 if(name==="wallet")return <svg {...common}><path d="M4 7h14a2 2 0 0 1 2 2v9H6a2 2 0 0 1-2-2V7Z"/><path d="M4 7V5a2 2 0 0 1 2-2h11"/><path d="M15 12h5"/></svg>
 if(name==="privacy")return <svg {...common}><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-4"/></svg>
 return null
}

function active(pathname:string,href:string){return href==="/"?pathname==="/":pathname===href||pathname.startsWith(href+"/")}

export function JhadinaShellNavigation(){
 const pathname=usePathname()??"/"
 const [open,setOpen]=useState(false)
 const wrap=useRef<HTMLDivElement>(null)
 useEffect(()=>setOpen(false),[pathname])
 useEffect(()=>{
  function close(event:MouseEvent){if(open&&wrap.current&&!wrap.current.contains(event.target as Node))setOpen(false)}
  function escape(event:KeyboardEvent){if(event.key==="Escape")setOpen(false)}
  document.addEventListener("mousedown",close);document.addEventListener("keydown",escape)
  return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape)}
 },[open])
 return <>
  <div className={styles.brand}><Link href="/" aria-label="Jhadina home"><span className={styles.brandMark}><Icon name="ask"/></span><span className={styles.brandText}>Jhadina</span></Link></div>
  <div ref={wrap} className={styles.moreWrap}>
   <button type="button" className={styles.worldsButton} aria-label="Open Jhadina worlds" aria-expanded={open} aria-controls="jhadina-worlds-menu" onClick={()=>setOpen(v=>!v)}><Icon name="more"/><span>Worlds</span></button>
   {open&&<nav id="jhadina-worlds-menu" className={styles.menu} aria-label="Jhadina worlds">
    <div className={styles.menuHead}><div><strong>Worlds</strong><span>Route-backed subsystems</span></div><Link href="/worlds">All worlds →</Link></div>
    <div className={styles.grid}>{worlds.map(([icon,name,href])=><Link className={[styles.world,active(pathname,href)?styles.active:""].filter(Boolean).join(" ")} key={href} href={href}><Icon name={icon}/><span>{name}</span></Link>)}</div>
    <div className={styles.menuFoot}><Link href="/approvals">Approvals</Link><Link href="/memory">Memory</Link><Link href="/health">System status</Link></div>
   </nav>}
  </div>
  <nav className={styles.primary} aria-label="Primary navigation">
   {primary.map(([icon,name,href])=><Link key={href} href={href} aria-current={active(pathname,href)?"page":undefined} className={[styles.navLink,active(pathname,href)?styles.active:""].filter(Boolean).join(" ")}><Icon name={icon}/><span>{name}</span></Link>)}
   <button type="button" className={[styles.navLink,open?styles.active:""].filter(Boolean).join(" ")} aria-label="More Jhadina worlds" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="more"/><span>More</span></button>
  </nav>
 </>
}
