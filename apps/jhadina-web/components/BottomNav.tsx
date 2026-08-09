'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

const items = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/history', label: 'History', icon: '◷' },
  { href: '/insights', label: 'Insights', icon: '✦' },
  { href: '/profile', label: 'Me', icon: '○' },
];

export default function BottomNav() {
  const router = useRouter();

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        position: 'fixed',
        left: 14,
        right: 14,
        bottom: 12,
        zIndex: 50,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 5,
        padding: '7px 7px calc(7px + env(safe-area-inset-bottom))',
        border: '1px solid rgba(67,78,71,.13)',
        borderRadius: 27,
        background: 'rgba(247,244,238,.84)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 18px 60px rgba(55,66,59,.15)',
      }}
    >
      {items.map((item) => {
        const active = item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              minHeight: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: 20,
              color: active ? '#33423a' : '#87918b',
              background: active ? 'rgba(219,228,220,.72)' : 'transparent',
              textDecoration: 'none',
              transition: 'transform .24s ease, background .24s ease, color .24s ease',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: '.025em' }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
