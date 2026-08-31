"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const products = [
  { name: "Tees", mark: "TEE" },
  { name: "Hoodies", mark: "HD" },
  { name: "Wall Art", mark: "ART" },
  { name: "Mugs", mark: "MUG" },
  { name: "Totes", mark: "TOTE" },
  { name: "Gifts", mark: "GIFT" },
];

const styles = ["Vintage", "Street", "Minimal", "Illustrated", "Luxury", "Wild"];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [product, setProduct] = useState("Tees");
  const [style, setStyle] = useState("Vintage");
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-8">
        <div>
          <div className="font-display text-xl tracking-tight">CREATE SOMETHING</div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.28em] text-cream/45">AI made · yours</div>
        </div>
        <button className="rounded-full border border-cream/15 px-4 py-2 text-xs text-cream/70 transition hover:border-gold hover:text-cream">
          Bag · 0
        </button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.05fr_.95fr] md:px-8 md:pt-0">
        <div>
          <p className="mb-5 text-xs uppercase tracking-[0.28em] text-gold">Make it yours</p>
          <h1 className="max-w-3xl font-display text-5xl leading-[.98] md:text-7xl">
            Your idea.<br />
            <span className="text-cream/45">On something real.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-cream/65 md:text-lg">
            Describe a design, drop in a photo, or start with a blank canvas. We turn it into artwork you can wear, hang, carry, or give.
          </p>

          <div className="mt-9 rounded-2xl border border-cream/15 bg-cream/[.055] p-4 shadow-2xl backdrop-blur">
            <label className="block text-xs uppercase tracking-[.2em] text-cream/45" htmlFor="idea">What do you want to make?</label>
            <textarea
              id="idea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A retro Miami night poster with neon palms and a chrome sports car…"
              className="mt-3 min-h-28 w-full resize-none bg-transparent text-base leading-6 text-cream outline-none placeholder:text-cream/25"
            />
            <div className="flex flex-wrap gap-2 border-t border-cream/10 pt-3">
              {styles.map((item) => (
                <button key={item} onClick={() => setStyle(item)} className={`rounded-full px-3 py-1.5 text-xs transition ${style === item ? "bg-gold text-ink" : "bg-cream/10 text-cream/60 hover:bg-cream/15"}`}>
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-cream/15 px-4 py-3 text-xs text-cream/65 transition hover:border-gold hover:text-cream">
                {fileName ? `✓ ${fileName}` : "＋ Add a photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)} />
              </label>
              <button className="flex-1 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-ink transition hover:shadow-gold-glow">
                Generate artwork
              </button>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative aspect-square overflow-hidden rounded-[2rem] border border-cream/10 bg-gradient-to-br from-honey-oak/35 via-bronze/30 to-ink p-6 shadow-2xl"
          >
            <div className="absolute inset-5 rounded-[1.5rem] border border-gold/20" />
            <div className="absolute left-1/2 top-1/2 w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-2xl border border-cream/15 bg-cream p-5 text-ink shadow-2xl">
              <div className="aspect-[4/5] rounded-xl border border-ink/10 bg-gradient-to-br from-honey-oak/30 via-cream to-gold/20 p-6">
                <div className="flex h-full flex-col justify-between">
                  <span className="text-[10px] uppercase tracking-[.3em] text-ink/50">Your next favorite thing</span>
                  <div>
                    <div className="font-display text-5xl leading-none md:text-6xl">{style}</div>
                    <div className="mt-3 max-w-[16rem] text-sm leading-5 text-ink/60">
                      {prompt || "Start with an idea and watch it become a product."}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-[.2em] text-ink/45">
                    <span>AI studio</span><span>{product}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-xs text-cream/45">
              <span>Live preview</span><span>01 / 04</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-20 md:px-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[.25em] text-gold">Choose your canvas</p>
            <h2 className="mt-2 font-display text-3xl">Put the art on something.</h2>
          </div>
          <span className="text-xs text-cream/35">{product}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {products.map((item) => (
            <button
              key={item.name}
              onClick={() => setProduct(item.name)}
              className={`group rounded-2xl border p-4 text-left transition ${product === item.name ? "border-gold/70 bg-gold/10" : "border-cream/10 bg-cream/[.035] hover:border-cream/25"}`}
            >
              <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-cream/10 to-cream/[.02] font-mono text-xs tracking-[.25em] text-cream/30 transition group-hover:text-gold/70">
                {item.mark}
              </div>
              <div className="mt-3 text-sm text-cream/75">{item.name}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
