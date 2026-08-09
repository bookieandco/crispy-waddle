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
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 50,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 24,
        background: 'rgba(18,18,21,.88)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        boxShadow: '0 18px 60px rgba(0,0,0,.42)',
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
              borderRadius: 17,
              color: active ? '#fff' : 'rgba(255,255,255,.48)',
              background: active ? 'rgba(255,255,255,.09)' : 'transparent',
              textDecoration: 'none',
              transition: 'all .18s ease',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 10, letterSpacing: '.03em' }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
