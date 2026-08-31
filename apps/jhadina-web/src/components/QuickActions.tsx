import { useState } from "react"
import styles from "./QuickActions.module.css"

type Action = { id: string; label: string; icon: string; capability: string }
type CommandResult = { status: "accepted" | "rejected"; requestId: string; reason?: string }

const actions: Action[] = [
  { id: "power", label: "Power", icon: "⏻", capability: "remote.power" },
  { id: "volume-down", label: "Vol −", icon: "🔉", capability: "remote.volume.down" },
  { id: "volume-up", label: "Vol +", icon: "🔊", capability: "remote.volume.up" },
  { id: "back", label: "Back", icon: "↩", capability: "remote.navigation.back" },
  { id: "home", label: "Home", icon: "⌂", capability: "remote.navigation.home" },
  { id: "up", label: "Up", icon: "↑", capability: "remote.navigation.up" },
  { id: "left", label: "Left", icon: "←", capability: "remote.navigation.left" },
  { id: "select", label: "OK", icon: "●", capability: "remote.navigation.select" },
  { id: "right", label: "Right", icon: "→", capability: "remote.navigation.right" },
  { id: "down", label: "Down", icon: "↓", capability: "remote.navigation.down" },
  { id: "play", label: "Play", icon: "▶︎", capability: "remote.media.play" },
  { id: "pause", label: "Pause", icon: "Ⅱ", capability: "remote.media.pause" },
]

const scenes = [
  { id: "movie-night", label: "Movie Night", capability: "remote.scene.execute" },
  { id: "goodnight", label: "Goodnight", capability: "remote.scene.execute" },
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
        <div><span className={styles.eyebrow}>Remote</span><h2>Quick Actions</h2></div>
        <span className={styles.status} aria-live="polite">{busy ? "Sending…" : lastAction ?? "Ready"}</span>
      </div>
      <div className={styles.grid}>
        {actions.map(action => <button key={action.id} type="button" className={styles.action} onClick={() => run(action.label, action.capability)} disabled={busy} aria-label={action.label}><span>{action.icon}</span><small>{action.label}</small></button>)}
      </div>
      <div className={styles.section}>
        <span className={styles.eyebrow}>Scenes</span>
        <div className={styles.scenes}>{scenes.map(scene => <button key={scene.id} type="button" className={styles.scene} onClick={() => run(scene.label, scene.capability)} disabled={busy}>{scene.label}</button>)}</div>
      </div>
    </section>
  )
}
