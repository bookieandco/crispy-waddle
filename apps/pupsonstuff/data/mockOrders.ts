// data/mockOrders.ts
//
// DEMO DATA. PupsonStuff has no cart, checkout, or order-persistence
// system yet — those are the README roadmap's Milestones 5 ("Shopping
// cart + checkout") and 6 ("Printful automation"), neither built. There
// is nowhere a real order in this app could come from.
//
// This exists so the admin dashboard's Orders page has something real
// to render and lay out against, instead of shipping an empty shell or
// (worse) a table that LOOKS like it's showing real numbers when it
// isn't. Every order below references real product names/prices pulled
// from data/hotspots.ts (not invented figures), but the orders
// themselves — customer names, dates, statuses — are fabricated.
// components/admin pages that read this MUST visibly label it as demo
// data; don't let this quietly become "real" just because it renders
// cleanly.

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered";

export interface MockOrderItem {
  productName: string;
  quantity: number;
  priceCents: number;
}

export interface MockOrder {
  id: string;
  customerName: string;
  /** ISO date string */
  placedAt: string;
  status: OrderStatus;
  items: MockOrderItem[];
}

export const mockOrders: MockOrder[] = [
  {
    id: "DEMO-1001",
    customerName: "Jamie Ortiz",
    placedAt: "2026-08-05",
    status: "delivered",
    items: [{ productName: "Insulated Bottle", quantity: 1, priceCents: 3400 }],
  },
  {
    id: "DEMO-1002",
    customerName: "Priya Nair",
    placedAt: "2026-08-06",
    status: "shipped",
    items: [
      { productName: "White Hoodie (M)", quantity: 1, priceCents: 5400 },
      { productName: "Geometric Mug", quantity: 2, priceCents: 2200 },
    ],
  },
  {
    id: "DEMO-1003",
    customerName: "Marcus Lee",
    placedAt: "2026-08-07",
    status: "processing",
    items: [{ productName: "Astronaut Portrait Canvas (16×20 in)", quantity: 1, priceCents: 8900 }],
  },
  {
    id: "DEMO-1004",
    customerName: "Sofia Bianchi",
    placedAt: "2026-08-07",
    status: "processing",
    items: [
      { productName: "Vintage Concert Tee (L)", quantity: 2, priceCents: 3400 },
      { productName: "Tote Bag", quantity: 1, priceCents: 2800 },
    ],
  },
  {
    id: "DEMO-1005",
    customerName: "Devon Clarke",
    placedAt: "2026-08-08",
    status: "pending",
    items: [{ productName: "Throw Pillow", quantity: 1, priceCents: 4500 }],
  },
  {
    id: "DEMO-1006",
    customerName: "Aiko Tanaka",
    placedAt: "2026-08-09",
    status: "pending",
    items: [
      { productName: "Classic White Mug", quantity: 1, priceCents: 2200 },
      { productName: "Regal Crown Portrait Canvas (12×16 in)", quantity: 1, priceCents: 6900 },
    ],
  },
];

export function mockOrderTotalCents(order: MockOrder): number {
  return order.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}
