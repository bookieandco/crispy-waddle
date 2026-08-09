"use client";

// Nav-rail-style sidebar — the one structural idea borrowed from
// Atuoha/shoes_shop_web_admin (a Flutter/Firebase admin dashboard, no
// code reused, just its information architecture: dashboard home /
// orders / products / categories as separate top-level screens). No
// vendor/user management here, unlike that reference — PupsonStuff is a
// single-store catalog, not a multivendor marketplace, so that section
// of its IA doesn't apply.

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/orders", label: "Orders", icon: "receipt" },
  { href: "/admin/art-styles", label: "Art Styles", icon: "wand" },
] as const;

function NavIcon({ name }: { name: (typeof NAV_ITEMS)[number]["icon"] }) {
  // Small inline SVGs rather than a new icon-library dependency — this
  // project hasn't needed one anywhere else yet.
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M3 8l9-5 9 5-9 5-9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "wand":
      return (
        <svg {...common}>
          <path d="M4 20L18 6" />
          <path d="M15 3l1.5 1.5M20 9.5L18.5 8M18 3l.7.7M14 8.7l.7.7" />
        </svg>
      );
  }
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r border-greige/40 bg-white/50">
      <div className="border-b border-greige/40 px-5 py-6">
        <span className="font-display text-lg text-bronze">PupsonStuff</span>
        <span className="mt-0.5 block text-xs tracking-wide text-ink/50">
          Admin
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-honey-oak text-cream"
                  : "text-ink/70 hover:bg-greige/30"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-greige/40 p-4">
        <Link
          href="/"
          className="block text-xs text-ink/50 hover:text-bronze hover:underline"
        >
          ← Back to store
        </Link>
        {/* Real, stated plainly rather than silently shipped: there's no
            auth check anywhere in app/admin — anyone with this URL can
            open it. Fine for local/dev use while this is being built;
            not fine to deploy as-is. Gating this is Milestone 7's
            "Supabase Auth" work (roadmap), not yet built. */}
        <p className="mt-3 text-[11px] leading-snug text-ink/40">
          No login gate yet — this URL isn&apos;t access-controlled.
        </p>
      </div>
    </aside>
  );
}
