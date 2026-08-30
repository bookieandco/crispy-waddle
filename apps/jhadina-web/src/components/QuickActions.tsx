import { useState } from "react"
import styles from "./QuickActions.module.css"

type Action = { id: string; label: string; icon: string }

const actions: Action[] = [
  { id: "power", label: "Power", icon: "⏻" },
  { id: "volume-down", label: "Vol −", icon: "🔉" },
  { id: "volume-up", label: "Vol +", icon: "🔊" },
  { id: "back", label: "Back", icon: "↩" },
  { id: "home", label: "Home", icon: "⌂" },
  { id: "up", label: "Up", icon: "↑" },
  { id: "left", label: "Left", icon: "←" },
  { id: "select", label: "OK", icon: "●" },
  { id: "right", label: "Right", icon: "→" },
  { id: "down", label: "Down", icon: "↓" },
  { id: "play-pause", label: "Play / Pause", icon: "▶︎" },
]

const scenes = [
  { id: "movie-night", label: "Movie Night" },
  { id: "goodnight", label: "Goodnight" },
]

export function QuickActions() {
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [vpnPaused, setVpnPaused] = useState(false)

  const run = (label: string) => setLastAction(label)

  return (
    <section className={styles.panel} aria-label="Remote quick actions">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Remote</span>
          <h2>Quick Actions</h2>
        </div>
        <span className={styles.status} aria-live="polite">{lastAction ? `Ready · ${lastAction}` : "Ready"}</span>
      </div>
      <div className={styles.grid}>
        {actions.map(action => <button key={action.id} type="button" className={styles.action} onClick={() => run(action.label)} aria-label={action.label}><span>{action.icon}</span><small>{action.label}</small></button>)}
      </div>
      <div className={styles.section}>
        <span className={styles.eyebrow}>Scenes</span>
        <div className={styles.scenes}>{scenes.map(scene => <button key={scene.id} type="button" className={styles.scene} onClick={() => run(scene.label)}>{scene.label}</button>)}</div>
      </div>
      <div className={styles.vpn}>
        <div><span className={styles.eyebrow}>VPN</span><strong>{vpnPaused ? "Paused" : "Active"}</strong></div>
        <button type="button" className={styles.vpnButton} onClick={() => setVpnPaused(value => !value)} aria-pressed={vpnPaused}>{vpnPaused ? "Resume VPN" : "Pause VPN"}</button>
      </div>
    </section>
  )
}
