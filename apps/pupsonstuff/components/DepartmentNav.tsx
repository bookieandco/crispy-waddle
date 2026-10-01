'use client';

const DEPARTMENTS = [
  { id: 'portraits', label: 'Portraits', x: 17 },
  { id: 'home', label: 'Home', x: 16 },
  { id: 'drinkware', label: 'Drinkware', x: 34 },
  { id: 'apparel', label: 'Apparel', x: 50 },
  { id: 'studio', label: 'Studio', x: 75 },
  { id: 'bags', label: 'Bags', x: 70 },
  { id: 'checkout', label: 'Checkout', x: 57 },
] as const;

export default function DepartmentNav({ onFocus }: { onFocus: (xPercent: number) => void }) {
  return (
    <nav
      aria-label="Boutique departments"
      className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[760px] gap-1 overflow-x-auto rounded-full border border-cream/15 bg-ink/78 p-1.5 text-[11px] font-medium text-cream shadow-2xl backdrop-blur-xl [scrollbar-width:none]"
    >
      {DEPARTMENTS.map((department) => (
        <button
          key={department.id}
          type="button"
          onClick={() => onFocus(department.x)}
          className="shrink-0 rounded-full px-3 py-2 text-cream/75 transition hover:bg-bronze hover:text-cream active:scale-95"
        >
          {department.label}
        </button>
      ))}
    </nav>
  );
}
