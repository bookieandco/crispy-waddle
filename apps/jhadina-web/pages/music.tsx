import type { NextPage } from "next";
import { JhadinaMusicCommand } from "../src/components/music/JhadinaMusicCommand";

type Track = { id: string; title: string; artist: string; album?: string; artworkUrl?: string; sourceUrl?: string; playable?: boolean; rightsStatus?: "owned" | "licensed" | "authorized_stream" | "unknown" };
type Playback = { status: "idle" | "playing" | "paused"; track?: Track };

const demoTracks: Track[] = [
  { id: "demo-1", title: "Night Drive", artist: "Jhadina Music", album: "After Hours", rightsStatus: "owned", playable: true },
  { id: "demo-2", title: "Deep Cut", artist: "Jhadina Music", album: "Discovery", rightsStatus: "authorized_stream", playable: true },
  { id: "demo-3", title: "Sunday Morning", artist: "Jhadina Music", album: "Daily Mix", rightsStatus: "licensed", playable: true },
];

export default function MusicPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#07080b", color: "#fff", padding: "28px 20px 120px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".35em", opacity: .38, textTransform: "uppercase" }}>Jhadina World</div>
            <h1 style={{ margin: "8px 0 0", fontSize: "clamp(30px, 6vw, 52px)", letterSpacing: "-.04em" }}>Music</h1>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.42)", maxWidth: 620 }}>One music home for discovery, your library, playlists, offline music, and the player.</p>
          </div>
          <div style={{ border: "1px solid rgba(255,255,255,.1)", borderRadius: 999, padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,.45)" }}>Music Core</div>
        </header>
        <JhadinaMusicCommand
          search={async (query) => demoTracks.filter((track) => `${track.title} ${track.artist} ${track.album ?? ""}`.toLowerCase().includes(query.toLowerCase()))}
          command={async (action): Promise<Playback> => ({ status: action === "pause" ? "paused" : action === "resume" || action === "play" ? "playing" : "idle", track: demoTracks[0] })}
        />
      </div>
    </main>
  );
}
