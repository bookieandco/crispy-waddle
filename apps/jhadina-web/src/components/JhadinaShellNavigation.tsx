'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "./JhadinaShellNavigation.module.css"

const worlds = [
  ["Ask Jhadina", "/ask-jhadina"],
  ["Music", "/music"],
  ["JhadinaTV", "/jhadinatv"],
  ["Growth", "/growth"],
  ["Opportunities", "/opportunity"],
  ["Calendar", "/calendar"],
  ["Campaign Polls", "/campaign/polls"],
  ["Placement", "/placement/worker/opportunities"],
  ["Privacy", "/settings/privacy"],
] as const

const primary = [
  ["Home", "/", HomeIcon],
  ["Ask", "/ask-jhadina", AskIcon],
  ["Work", "/opportunity", WorkIcon],
  ["Activity", "/activity", ActivityIcon],
] as const

function HomeIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/></svg>}
function AskIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8Z"/></svg>}
function WorkIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6V4h6v2m-12 4h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 4h18M9 14h6"/></svg>}
function ActivityIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V9m5 9V5m5 13v-7m5 7V3"/></svg>}
function MoreIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>}

export function JhadinaShellNavigation() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const active = (href:string) => href === "/" ? pathname === "/" : pathname.startsWith(href)

  return <>
    <header className={styles.shellTop}>
      <Link href="/" className={styles.brand} aria-label="Jhadina home">Jhadina</Link>
      <div className={styles.worldsWrap}>
        <button className={styles.menuButton} aria-label="Open Jhadina worlds" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
          <MoreIcon/><span>Worlds</span>
        </button>
        {open && <nav className={styles.menu} aria-label="Jhadina worlds">
          <div className={styles.menuTitle}>Worlds</div>
          <div className={styles.grid}>{worlds.map(([name,href])=><Link className={styles.world} key={name} href={href} onClick={()=>setOpen(false)}><span className={styles.worldName}>{name}</span><span aria-hidden="true">→</span></Link>)}</div>
        </nav>}
      </div>
    </header>
    <nav className={styles.bottom} aria-label="Primary navigation">
      {primary.map(([name,href,Icon])=><Link key={name} href={href} aria-current={active(href) ? "page" : undefined} className={styles.navLink}><span className={styles.navIcon}><Icon/></span><span>{name}</span></Link>)}
      <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={styles.navLink}><span className={styles.navIcon}><MoreIcon/></span><span>More</span></button>
    </nav>
  </>
}
