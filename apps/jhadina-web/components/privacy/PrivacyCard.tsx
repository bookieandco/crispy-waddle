"use client";

import { useState } from "react";

type Status = "disconnected" | "connecting" | "connected" | "error";

export function PrivacyCard() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [location, setLocation] = useState<string | null>(null);

  async function toggle() {
    const next = status === "connected" ? "disconnected" : "connecting";
    setStatus(next);
    if (next === "connecting") {
      // UI-only until a platform VPN adapter is installed. No credentials
      // or raw tunnel configuration are handled by the web application.
      window.setTimeout(() => {
        setStatus("connected");
        setLocation("Protected profile");
      }, 500);
    } else {
      setLocation(null);
    }
  }

  const connected = status === "connected";

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[.3em] text-white/35">Privacy</p>
          <h2 className="mt-2 text-xl font-medium">Jhadina Privacy</h2>
          <p className="mt-2 text-sm text-white/40">{connected ? "Your selected protection profile is active." : "Your connection is not protected by Jhadina."}</p>
        </div>
        <div className={`mt-1 h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-white/20"}`} />
      </div>
      {location && <div className="mt-5 rounded-xl bg-black/20 px-4 py-3 text-sm text-white/55">Profile · {location}</div>}
      <button type="button" onClick={toggle} disabled={status === "connecting"} className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black disabled:opacity-50">
        {status === "connecting" ? "Connecting…" : connected ? "Disconnect" : "Connect"}
      </button>
      <p className="mt-4 text-xs leading-5 text-white/25">VPN credentials and tunnel configuration remain outside the Jhadina AI layer.</p>
    </section>
  );
}
