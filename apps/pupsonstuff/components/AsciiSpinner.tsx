"use client";

// AsciiSpinner — the other half of the ASCII-art request: a loading
// effect built from the same monospace-character aesthetic as
// lib/ascii.ts's art style, used while a portrait/animation is
// generating. Pure client-side interval-driven frame cycling — no
// dependency on lib/ascii.ts itself (that's server-only, image
// processing), just the same visual language.

import { useEffect, useState } from "react";

const FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

const FRAME_MS = 90;

interface Props {
  label?: string;
}

export default function AsciiSpinner({ label = "Generating…" }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  // Own dark background (matching the "Loading 3D boutique…" pattern in
  // Boutique.tsx) rather than inheriting the preview box's light
  // bg-white/40 — cream-on-white would barely be legible.
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg bg-ink font-mono text-cream/90">
      <span aria-hidden className="text-4xl leading-none text-gold">
        {FRAMES[frame]}
      </span>
      <span className="text-xs tracking-wide text-cream/70">{label}</span>
    </div>
  );
}
