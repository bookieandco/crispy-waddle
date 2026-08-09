"use client";

import { useMemo, useState } from "react";
import {
  createInteraction,
  type InteractionMode,
  type JhadinaInteraction,
} from "../../src/lib/flow/jhadina-interaction";
import type { CommandContext } from "../../src/lib/flow/jhadina-command-context";

const greetings = [
  "What's the deal, foolie?",
  "What we getting into?",
  "Talk to me.",
  "What you need?",
];

export function UniversalJhadinaSurface({ context, onSubmit }: { context: CommandContext; onSubmit?: (interaction: JhadinaInteraction) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [interaction, setInteraction] = useState<JhadinaInteraction | null>(null);
  const greeting = useMemo(() => greetings[Math.floor(Math.random() * greetings.length)], []);

  function openJhadina(mode: InteractionMode = "open") {
    const next = createInteraction(mode, context);
    setInteraction(next);
    setOpen(true);
  }

  function submit() {
    const value = text.trim();
    if (!value || !interaction) return;
    const next = {
      ...interaction,
      state: "thinking" as const,
      request: {
        transcript: value,
        context,
        requestedAt: new Date().toISOString(),
      },
    };
    setInteraction(next);
    onSubmit?.(next);
  }

  return <>
    <button aria-label="Open Jhadina" onClick={() => openJhadina()} className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl transition hover:scale-105">
      ◉ Jhadina
    </button>

    {open && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Jhadina" onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0b0c10]/95 p-5 text-white shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[.3em] text-white/35">Jhadina</p><h2 className="mt-1 text-xl font-semibold">{interaction?.state === "thinking" ? "I'm on it." : greeting}</h2></div>
          <button onClick={() => setOpen(false)} aria-label="Close Jhadina" className="rounded-full px-3 py-2 text-white/45 hover:bg-white/10 hover:text-white">×</button>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit(); }} autoFocus placeholder="Tell Jhadina what you want…" className="min-h-24 w-full resize-none bg-transparent text-sm outline-none placeholder:text-white/25" />
          <div className="mt-2 flex items-center justify-between"><button onClick={() => openJhadina("listen")} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/10">🎙 Listen</button><button onClick={submit} disabled={!text.trim()} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-30">Send</button></div>
        </div>
        {context.awareness.filter((item) => item.level !== "silent").slice(0, 3).map((item) => <button key={item.flowId} className="mt-3 block w-full rounded-xl border border-white/8 bg-white/[.025] p-3 text-left hover:bg-white/[.06]"><p className="text-xs font-medium">{item.title}</p><p className="mt-1 text-[11px] text-white/35">{item.reason}</p></button>)}
      </section>
    </div>}
  </>;
}
