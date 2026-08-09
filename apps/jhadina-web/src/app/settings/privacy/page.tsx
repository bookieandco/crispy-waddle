"use client";

import { useMemo, useState } from "react";
import { DEFAULT_KILL_SWITCH_POLICY, evaluateKillSwitch, type KillSwitchMode, type NetworkTrust } from "@jhadina/privacy-core";

type VpnStatus = "connected" | "disconnected";

export default function PrivacySettingsPage() {
  const [mode, setMode] = useState<KillSwitchMode>(DEFAULT_KILL_SWITCH_POLICY.mode);
  const [vpnStatus] = useState<VpnStatus>("disconnected");
  const [network, setNetwork] = useState<NetworkTrust>("unknown");

  const decision = useMemo(() => evaluateKillSwitch({ mode }, { status: vpnStatus }, network), [mode, vpnStatus, network]);
  const blocked = !decision.allowTraffic;

  return (
    <main className="min-h-screen bg-[#07080b] text-white">
      <div className="mx-auto max-w-4xl px-5 pb-20 pt-8 md:px-10 md:pt-12">
        <p className="text-[11px] uppercase tracking-[.35em] text-white/35">Jhadina · Settings</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">Privacy</h1>
        <p className="mt-4 max-w-2xl text-white/40">Control how Jhadina manages VPN protection. These policies are deterministic and do not give the AI direct access to network credentials.</p>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[.045] p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-lg font-medium">Kill switch</p><p className="mt-1 text-sm text-white/40">Block network traffic when the required VPN protection is unavailable.</p></div>
            <span className={`rounded-full border px-3 py-1 text-xs ${blocked ? "border-red-400/20 bg-red-400/10 text-red-200" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{blocked ? "Protected · traffic blocked" : "Traffic allowed"}</span>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {(["off", "untrusted-network", "always"] as KillSwitchMode[]).map((option) => (
              <button key={option} onClick={() => setMode(option)} className={`rounded-2xl border p-4 text-left ${mode === option ? "border-white/30 bg-white/10" : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                <p className="font-medium">{option === "off" ? "Off" : option === "always" ? "Always" : "Untrusted networks"}</p>
                <p className="mt-1 text-xs leading-5 text-white/35">{option === "off" ? "Never block traffic." : option === "always" ? "Require VPN protection for traffic." : "Require VPN on unknown or untrusted networks."}</p>
              </button>
            ))}
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="text-xs uppercase tracking-widest text-white/30">VPN status</span><p className="mt-2 font-medium">{vpnStatus}</p></label>
            <label className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="text-xs uppercase tracking-widest text-white/30">Network trust</span><select value={network} onChange={(e) => setNetwork(e.target.value as NetworkTrust)} className="mt-2 w-full bg-transparent outline-none"><option value="trusted" className="bg-[#101116]">Trusted</option><option value="untrusted" className="bg-[#101116]">Untrusted</option><option value="unknown" className="bg-[#101116]">Unknown</option></select></label>
          </div>
        </section>

        <section className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-6"><p className="text-lg font-medium">VPN connection</p><p className="mt-2 text-sm text-white/40">The platform adapter will provide the real connection state. Credentials and raw tunnel configuration stay outside the AI layer.</p><div className="mt-5 rounded-xl bg-black/20 px-4 py-3 text-sm text-white/50">Currently: platform adapter not connected</div></article>
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[.035] p-6"><p className="text-lg font-medium">Policy decision</p><p className="mt-2 text-sm text-white/40">{blocked ? "Traffic would be blocked until VPN protection is available." : "Traffic is currently permitted by the selected policy."}</p><div className="mt-5 text-xs uppercase tracking-widest text-white/25">Reason: {decision.reason}</div></article>
        </section>
      </div>
    </main>
  );
}
