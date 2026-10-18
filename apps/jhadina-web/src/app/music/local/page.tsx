"use client";

import { useState } from "react";

/** No Supabase/Auth/Storage imports. The preview host is protected by Vercel Authentication. */
export default function LocalMusicQuickStartPage() {
  const [opened, setOpened] = useState(false);
  function openPlayer() {
    window.dispatchEvent(new Event("jhadina:open-local-music"));
    setOpened(true);
  }
  return (
    <main className="min-h-screen bg-[#07080b] px-5 pb-40 pt-16 text-white">
      <div className="mx-auto max-w-lg">
        <p className="text-xs uppercase tracking-[.24em] text-emerald-300/80">Jhadina · Private Preview</p>
        <h1 className="mt-4 text-4xl font-semibold">Your music. On your phone.</h1>
        <p className="mt-4 text-base leading-7 text-white/65">
          Play MP3, M4A, WAV and other audio files you already have, even while the cloud library is unavailable.
          Choose files from the iPhone Files app. They stay in this browser and are never uploaded to Jhadina.
        </p>
        <button type="button" onClick={openPlayer}
          className="mt-8 w-full rounded-2xl bg-emerald-400 px-5 py-4 text-base font-semibold text-black">
          {opened ? "Open My Local Music Again" : "Open My Local Music"}
        </button>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <h2 className="text-lg font-semibold">How to listen</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-white/65">
            <li>Tap Open My Local Music.</li>
            <li>Choose an audio file saved in iPhone Files.</li>
            <li>Tap the track to play it. Keep originals backed up.</li>
            <li>Use Control Center to route audio to AirPods, Bluetooth or AirPlay.</li>
          </ol>
        </div>
        <p className="mt-6 text-xs leading-5 text-white/40">
          Private browser storage is device/profile-specific and may be erased by iOS. This is not Spotify, YouTube
          Music streaming, or a hosted music library. Cloud catalog and licensed-stream acceptance remain separately gated.
        </p>
      </div>
    </main>
  );
}
