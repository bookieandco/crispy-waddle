'use client'

import { useState } from "react"
import Link from "next/link"
import styles from "./JhadinaShellNavigation.module.css"

const worlds = [
  ["🎵", "Music", "/music"],
  ["📺", "JhadinaTV", "/jhadinatv"],
  ["🎬", "Studio", "/film"],
  ["📱", "Social", "/social"],
  ["🐶", "PupsonStuff", "/pupsonstuff"],
  ["🚛", "TruckerOS", "/trucker"],
  ["🍳", "Cooking", "/cooking"],
  ["🛒", "Shopping", "/shopping"],
  ["📡", "Radar", "/radar"],
  ["🧠", "Knowledge", "/knowledge"],
] as const

const primary = [
  ["🏡", "Home", "/"],
  ["💵", "Money", "/money/command-center"],
  ["✦", "Jhadina", "/ask-jhadina"],
  ["🎯", "Opportunities", "/opportunity"],
  ["📋", "Activity", "/activity"],
] as const

export function JhadinaShellNavigation() {
  const [open, setOpen] = useState(false)
  return <>
    <header className={styles.shellTop}><div className={styles.worldsWrap}>
      <button className={styles.menuButton} aria-label="Open Jhadina worlds" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>✦</button>
      {open && <nav className={styles.menu} aria-label="Jhadina worlds">
        <div className={styles.menuTitle}>Jhadina · Worlds</div>
        <div className={styles.grid}>{worlds.map(([icon,name,href])=><Link className={styles.world} key={name} href={href} onClick={()=>setOpen(false)}><span className={styles.worldIcon}>{icon}</span><span className={styles.worldName}>{name}</span></Link>)}</div>
      </nav>}
    </div></header>
    <nav className={styles.bottom} aria-label="Primary navigation">
      {primary.map(([icon,name,href])=><Link key={name} href={href} className={`${styles.navLink} ${name === "Jhadina" ? styles.ask : ""}`}><span className={styles.navIcon}>{icon}</span><span>{name}</span></Link>)}
    </nav>
    <div className={styles.fabHint} aria-hidden="true">Ask Jhadina anywhere</div>
  </>
}
