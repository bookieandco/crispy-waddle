'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const items = [
  { href: '/', label: 'Home', icon: '🏡' },
  { href: '/money', label: 'Money', icon: '💵' },
  { href: '/#ask-jhadina', label: 'Ask Jhadina', icon: '🤷🏾' },
  { href: '/opportunity', label: 'Opportunity', icon: '🎥✊🏾' },
  { href: '/activity', label: 'Activity', icon: '📋' },
] as const;

const worlds = [
  { href: '/music', label: 'Music', icon: '🎵' },
  { href: '/jhadinatv', label: 'JhadinaTV', icon: '📺' },
  { href: '/film', label: 'Film', icon: '🎬' },
  { href: '/social', label: 'Social / Growth', icon: '📱' },
  { href: '/pupsonstuff', label: 'PupsonStuff', icon: '🐶' },
  { href: '/trucker', label: 'TruckerOS', icon: '🚛' },
] as const;

export default function BottomNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open worlds"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          position: 'fixed', top: 14, right: 14, zIndex: 70,
          width: 46, height: 46, borderRadius: 15,
          border: '1px solid rgba(67,78,71,.13)',
          background: 'rgba(247,244,238,.9)', color: '#33423a',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 12px 34px rgba(55,66,59,.14)', fontSize: 21,
        }}
      >📂</button>

      {open && (
        <nav aria-label="Jhadina worlds" style={{
          position: 'fixed', top: 68, right: 14, zIndex: 69,
          display: 'grid', gap: 4, width: 215, padding: 8,
          border: '1px solid rgba(67,78,71,.13)', borderRadius: 18,
          background: 'rgba(247,244,238,.97)', backdropFilter: 'blur(24px)',
          boxShadow: '0 18px 60px rgba(55,66,59,.18)',
        }}>
          {worlds.map((world) => (
            <Link key={world.href} href={world.href} onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              color: '#405047', textDecoration: 'none', fontSize: 14,
            }}>
              <span style={{ fontSize: 18 }}>{world.icon}</span>{world.label}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label="Primary navigation" style={{
        position: 'fixed', left: 10, right: 10, bottom: 10, zIndex: 50,
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
        padding: '7px 7px calc(7px + env(safe-area-inset-bottom))',
        border: '1px solid rgba(67,78,71,.13)', borderRadius: 27,
        background: 'rgba(247,244,238,.88)', backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 18px 60px rgba(55,66,59,.15)',
      }}>
        {items.map((item) => {
          const active = item.href === '/#ask-jhadina'
            ? router.pathname === '/'
            : item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} style={{
              minHeight: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, borderRadius: 20, color: active ? '#33423a' : '#87918b',
              background: active ? 'rgba(219,228,220,.72)' : 'transparent', textDecoration: 'none',
              fontWeight: item.label === 'Ask Jhadina' ? 800 : 600,
              transform: item.label === 'Ask Jhadina' ? 'translateY(-2px) scale(1.04)' : undefined,
            }}>
              <span style={{ fontSize: item.label === 'Opportunity' ? 17 : 20, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 9.5 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
