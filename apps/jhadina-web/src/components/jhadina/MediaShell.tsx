"use client";

import type { ReactNode } from "react";

export function MediaShell({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return <main className="min-h-screen bg-[#07080b] pb-28 text-white"><div className="mx-auto max-w-[1500px] px-5 pb-24 pt-7 md:px-10 md:pt-10"><header className="mb-9 flex items-end justify-between gap-6"><div><p className="text-[10px] font-medium uppercase tracking-[.34em] text-white/35">{eyebrow ?? "Jhadina"}</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] md:text-6xl">{title}</h1></div>{action}</header>{children}</div></main>;
}

export function MediaRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="mt-10"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>{description && <p className="mt-1 text-sm text-white/35">{description}</p>}</div><button className="text-xs text-white/40 hover:text-white">See all</button></div><div className="grid auto-cols-[150px] grid-flow-col gap-4 overflow-x-auto pb-2 md:auto-cols-[210px]">{children}</div></section>;
}

export function PosterCard({ title, meta, label, wide = false }: { title: string; meta: string; label?: string; wide?: boolean }) {
  return <article className={`${wide ? "col-span-2" : ""} group min-w-0 cursor-pointer`}><div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/15 via-white/[.04] to-black shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20 group-hover:shadow-2xl"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.22),transparent_35%)]" /><div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-4"><p className="text-sm font-semibold leading-tight">{title}</p><p className="mt-1 text-[11px] text-white/55">{meta}</p></div>{label && <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[9px] uppercase tracking-[.18em] text-white/70 backdrop-blur">{label}</span>}</div></article>;
}

export function SocialCard({ name, text, stat }: { name: string; text: string; stat: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[.045] p-5 transition hover:bg-white/[.07]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-white/30 to-white/5 text-xs font-bold">{name.slice(0,2).toUpperCase()}</div><div><p className="text-sm font-semibold">{name}</p><p className="text-[11px] text-white/30">just now</p></div></div><p className="mt-5 text-sm leading-6 text-white/75">{text}</p><div className="mt-5 flex justify-between text-[11px] text-white/35"><span>{stat}</span><span>♡  ·  💬  ·  ↗</span></div></article>;
}
