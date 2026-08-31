import { useState } from "react"
import styles from "./QuickActions.module.css"

type Action = { id: string; label: string; icon: string; capability: string }

type CommandResult = { status: "accepted" | "rejected"; requestId: string; reason?: string }

const actions: Action[] = [
  { id: "power", label: "Power", icon: "⏻", capability: "remote.power" },
  { id: "volume-down", label: "Vol −", icon: "🔉", capability: "remote.volume_down" },
  { id: "volume-up", label: "Vol +", icon: "🔊", capability: "remote.volume_up" },
  { id: "back", label: "Back", icon: "↩", capability: "remote.back" },
  { id: "home", label: "Home", icon: "⌂", capability: "remote.home" },
  { id: "up", label: "Up", icon: "↑", capability: "remote.up" },
  { id: "left", label: "Left", icon: "←", capability: "remote.left" },
  { id: "select", label: "OK", icon: "●", capability: "remote.select" },
  { id: "right", label: "Right", icon: "→", capability: "remote.right" },
  { id: "down", label: "Down", icon: "↓", capability: "remote.down" },
  { id: "play-pause", label: "Play / Pause", icon: "▶︎", capability: "remote.play_pause" },
]

const scenes = [
  { id: "movie-night", label: "Movie Night" },
  { id: "goodnight", label: "Goodnight" },
]

export function QuickActions() {
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (label: string, capability: string) => {
    if (busy) return
    setBusy(true)
    const requestId = crypto.randomUUID()
    try {
      const response = await fetch("/api/remote/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, deviceId: "tv-1", capability }),
      })
      const result = (await response.json()) as CommandResult
      setLastAction(result.status === "accepted" ? `Executed · ${label}` : `Denied · ${label}`)
    } catch {
      setLastAction(`Failed · ${label}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel} aria-label="Remote quick actions">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Remote</span>
          <h2>Quick Actions</h2>
        </div>
        <span className={styles.status} aria-live="polite">{busy ? "Sending…" : lastAction ?? "Ready"}</span>
      </div>
      <div className={styles.grid}>
        {actions.map(action => <button key={action.id} type="button" className={styles.action} onClick={() => run(action.label, action.capability)} disabled={busy} aria-label={action.label}><span>{action.icon}</span><small>{action.label}</small></button>)}
      </div>
      <div className={styles.section}>
        <span className={styles.eyebrow}>Scenes</span>
        <div className={styles.scenes}>{scenes.map(scene => <button key={scene.id} type="button" className={styles.scene} onClick={() => setLastAction(scene.label)}>{scene.label}</button>)}</div>
      </div>
    </section>
  )
}
