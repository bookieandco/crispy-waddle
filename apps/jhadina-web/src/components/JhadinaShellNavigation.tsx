'use client'

import { useState } from "react"
import Link from "next/link"
import styles from "./JhadinaShellNavigation.module.css"

/**
 * Worlds dropdown and primary bottom nav.
 *
 * Route list is intentionally scoped to what actually builds and
 * resolves on this app today (verified against the real Next.js route
 * manifest) — not the full "Worlds" roster this shell was originally
 * designed for (Studio, Social, TruckerOS, Cooking, Shopping, Radar,
 * Knowledge, etc.), most of which don't have a page here yet. Add an
 * entry once its route actually exists rather than shipping a dead
 * link ahead of it.
 */
const worlds = [
  ["🎵", "Music", "/music"],
  ["📺", "JhadinaTV", "/jhadinatv"],
  ["📈", "Growth", "/growth"],
  ["🗒️", "Activity", "/activity"],
  ["🎯", "Opportunities", "/opportunity"],
  ["🗓️", "Calendar", "/calendar"],
  ["📊", "Campaign Polls", "/campaign/polls"],
  ["🤝", "Placement", "/placement/worker/opportunities"],
  ["🔒", "Privacy", "/settings/privacy"],
] as const

const primary = [
  ["🏡", "Home", "/"],
  ["📈", "Growth", "/growth"],
  ["🎵", "Music", "/music"],
  ["🎯", "Opportunities", "/opportunity"],
  ["📺", "JhadinaTV", "/jhadinatv"],
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
      {primary.map(([icon,name,href])=><Link key={name} href={href} className={styles.navLink}><span className={styles.navIcon}>{icon}</span><span>{name}</span></Link>)}
    </nav>
  </>
}
