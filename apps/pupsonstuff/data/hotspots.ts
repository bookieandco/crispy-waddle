// data/hotspots.ts
//
// Single source of truth for every clickable zone on the boutique image
// AND the product/inventory data that powers its customization panel.
//
// Coordinates are percentages (0-100) relative to the boutique image's
// width/height. This pass re-measured several regions directly against the
// photo's pixels — the pillow hotspot was wrong before (covering chair +
// armrest), drinkware was one box over three separate items, and the wall
// art gallery was one box over six separate frames. All fixed here as
// individual hotspots.
//
// `silhouette` references a shape template in lib/silhouettes.ts — a real
// product silhouette (bottle, mug + handle, shirt, tote, pillow, frame),
// not a circle or plain rectangle. These are hand-fit, not pixel-traced:
// automatic contour extraction (GrabCut) was tried and discarded because
// it kept finding noisy/wrong shapes against this photo's backgrounds.
//
// FULFILLMENT PROVIDER: this project's actual accounts are Printful. The
// schema is provider-agnostic (`provider` field) so this can point at
// Printify per-hotspot later without touching any component.

import { SilhouetteId } from "@/lib/silhouettes";

export type ProductType =
  | "canvas"
  | "pillow"
  | "bottle"
  | "mug"
  | "hoodie"
  | "shirt"
  | "shirts"
  | "tote"
  | "upload"
  | "checkout";

export type FulfillmentProvider = "printful" | "printify";

export interface InventoryVariant {
  variantId: string;
  label: string;
  priceCents: number;
  sku?: string;
}

export interface PrintArea {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FulfillmentMapping {
  provider: FulfillmentProvider;
  productId: string;
  blueprintId?: string;
  printProviderId?: string;
  variants: InventoryVariant[];
  printArea: PrintArea;
}

export interface CustomizationOptions {
  sizes?: string[];
  colors?: string[];
}

export interface Hotspot {
  id: string;
  name: string;
  product: ProductType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which real silhouette shape (lib/silhouettes.ts) this product uses. */
  silhouette: SilhouetteId;
  fulfillment?: FulfillmentMapping;
  aiTemplate?: string;
  customization?: CustomizationOptions;
  description?: string;
  estimatedDeliveryDays?: [number, number];
}

export const hotspots: Hotspot[] = [
  // ---- Wall art: 6 individual frames, was one "gallery" box ----
  {
    id: "frame1",
    name: "Astronaut Portrait Canvas",
    product: "canvas",
    x: 6,
    y: 10,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed astronaut-style pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render as an astronaut-suited pet portrait, dramatic space lighting.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },
  {
    id: "frame2",
    name: "Royal Uniform Portrait Canvas",
    product: "canvas",
    x: 13.67,
    y: 10,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed royal-uniform pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render in a royal military uniform style, medals and sash.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },
  {
    id: "frame3",
    name: "Pop Art Portrait Canvas",
    product: "canvas",
    x: 21.33,
    y: 10,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed geometric pop-art pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render as bold geometric pop-art, saturated color blocks.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },
  {
    id: "frame4",
    name: "Regal Crown Portrait Canvas",
    product: "canvas",
    x: 6,
    y: 26,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed crowned-and-collared pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render wearing a jeweled crown and ornate collar, regal lighting.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },
  {
    id: "frame5",
    name: "Soft Watercolor Portrait Canvas",
    product: "canvas",
    x: 13.67,
    y: 26,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed soft watercolor pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render as a soft pastel watercolor wash, gentle brush texture.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },
  {
    id: "frame6",
    name: "Uniformed Portrait Canvas",
    product: "canvas",
    x: 21.33,
    y: 26,
    width: 7.67,
    height: 16,
    silhouette: "rect",
    description: "Framed dress-uniform pet portrait, gallery quality.",
    estimatedDeliveryDays: [5, 8],
    fulfillment: {
      provider: "printful",
      productId: "FUL-CANVAS-PLACEHOLDER",
      printArea: { name: "full bleed", x: 8, y: 8, width: 84, height: 84 },
      variants: [
        { variantId: "FUL-CANVAS-12x16", label: "12×16 in", priceCents: 6900 },
        { variantId: "FUL-CANVAS-16x20", label: "16×20 in", priceCents: 8900 },
        { variantId: "FUL-CANVAS-20x30", label: "20×30 in", priceCents: 12900 },
      ],
    },
    aiTemplate: "Render in formal dress uniform, crisp studio portrait lighting.",
    customization: { sizes: ["12×16 in", "16×20 in", "20×30 in"] },
  },

  // ---- Pillow: bounds corrected to hug the cushion, not the chair ----
  {
    id: "pillow",
    name: "Throw Pillow",
    product: "pillow",
    x: 10.5,
    y: 59,
    width: 11,
    height: 17,
    silhouette: "pillow",
    description: "Soft-cover throw pillow, portrait centered front and back.",
    estimatedDeliveryDays: [4, 7],
    fulfillment: {
      provider: "printful",
      productId: "FUL-PILLOW-PLACEHOLDER",
      printArea: { name: "center", x: 20, y: 20, width: 60, height: 60 },
      variants: [
        { variantId: "FUL-PILLOW-18x18", label: "18×18 in", priceCents: 4500 },
      ],
    },
    aiTemplate: "Render as a soft textile print, centered, cozy home decor tone.",
    customization: { sizes: ["18×18 in"] },
  },

  // ---- Drinkware: 3 individual items, was one shared box ----
  {
    id: "bottle",
    name: "Insulated Bottle",
    product: "bottle",
    x: 25.5,
    y: 55.5,
    width: 5.5,
    height: 16,
    silhouette: "bottle",
    description: "Insulated water bottle, wraparound portrait print.",
    estimatedDeliveryDays: [4, 7],
    fulfillment: {
      provider: "printful",
      productId: "FUL-BOTTLE-PLACEHOLDER",
      printArea: { name: "wrap", x: 0, y: 15, width: 100, height: 70 },
      variants: [
        { variantId: "FUL-BOTTLE-STD", label: "20oz", priceCents: 3400 },
      ],
    },
    aiTemplate: "Render as a wraparound bottle print, bold and legible at small scale.",
    customization: { colors: ["Stainless", "Black"] },
  },
  {
    id: "mugColorful",
    name: "Geometric Mug",
    product: "mug",
    x: 30.5,
    y: 59,
    width: 7,
    height: 13.5,
    silhouette: "mugHandle",
    description: "Ceramic mug, full-color geometric portrait print.",
    estimatedDeliveryDays: [4, 7],
    fulfillment: {
      provider: "printful",
      productId: "FUL-MUG-PLACEHOLDER",
      printArea: { name: "wrap", x: 5, y: 10, width: 70, height: 80 },
      variants: [
        { variantId: "FUL-MUG-11OZ", label: "11oz", priceCents: 2200 },
      ],
    },
    aiTemplate: "Render as a wraparound mug print, bold geometric color blocks.",
    customization: { colors: ["White"] },
  },
  {
    id: "mugWhite",
    name: "Classic White Mug",
    product: "mug",
    x: 37,
    y: 60,
    width: 6.5,
    height: 11.5,
    silhouette: "mugHandle",
    description: "Ceramic mug, clean portrait print on classic white.",
    estimatedDeliveryDays: [4, 7],
    fulfillment: {
      provider: "printful",
      productId: "FUL-MUG-PLACEHOLDER",
      printArea: { name: "wrap", x: 5, y: 10, width: 70, height: 80 },
      variants: [
        { variantId: "FUL-MUG-11OZ", label: "11oz", priceCents: 2200 },
      ],
    },
    aiTemplate: "Render as a wraparound mug print, clean and legible on white ceramic.",
    customization: { colors: ["White"] },
  },

  // ---- Apparel ----
  {
    id: "whiteHoodie",
    name: "White Hoodie",
    product: "hoodie",
    x: 36,
    y: 42,
    width: 10,
    height: 23,
    silhouette: "shirt",
    description: "Heavyweight hoodie, front-chest portrait print.",
    estimatedDeliveryDays: [5, 9],
    fulfillment: {
      provider: "printful",
      productId: "FUL-HOODIE-WHITE-PLACEHOLDER",
      printArea: { name: "front chest", x: 28, y: 22, width: 44, height: 34 },
      variants: [
        { variantId: "FUL-HOODIE-WHITE-S", label: "S", priceCents: 5400 },
        { variantId: "FUL-HOODIE-WHITE-M", label: "M", priceCents: 5400 },
        { variantId: "FUL-HOODIE-WHITE-L", label: "L", priceCents: 5400 },
        { variantId: "FUL-HOODIE-WHITE-XL", label: "XL", priceCents: 5800 },
      ],
    },
    aiTemplate: "Render as a front-chest apparel graphic, clean edges, off-white garment.",
    customization: { sizes: ["S", "M", "L", "XL"], colors: ["White"] },
  },
  {
    id: "concertShirt",
    name: "Vintage Concert Tee",
    product: "shirt",
    x: 47,
    y: 43,
    width: 10,
    height: 22,
    silhouette: "shirt",
    description: "Distressed vintage-style tee with a retro halftone portrait.",
    estimatedDeliveryDays: [5, 9],
    fulfillment: {
      provider: "printful",
      productId: "FUL-TEE-CONCERT-PLACEHOLDER",
      printArea: { name: "front", x: 25, y: 20, width: 50, height: 40 },
      variants: [
        { variantId: "FUL-TEE-CONCERT-S", label: "S", priceCents: 3400 },
        { variantId: "FUL-TEE-CONCERT-M", label: "M", priceCents: 3400 },
        { variantId: "FUL-TEE-CONCERT-L", label: "L", priceCents: 3400 },
        { variantId: "FUL-TEE-CONCERT-XL", label: "XL", priceCents: 3800 },
      ],
    },
    aiTemplate:
      "Render in a distressed vintage band-tee style, retro halftone texture, bold central portrait.",
    customization: { sizes: ["S", "M", "L", "XL"], colors: ["Black"] },
  },
  {
    id: "foldedShirts",
    name: "Folded Apparel",
    product: "shirts",
    x: 39,
    y: 76,
    width: 22,
    height: 14,
    silhouette: "rect",
    description: "Everyday soft-cotton graphic tee, front-chest print.",
    estimatedDeliveryDays: [5, 9],
    fulfillment: {
      provider: "printful",
      productId: "FUL-TEE-FOLDED-PLACEHOLDER",
      printArea: { name: "front", x: 25, y: 20, width: 50, height: 40 },
      variants: [
        { variantId: "FUL-TEE-FOLDED-S", label: "S", priceCents: 3200 },
        { variantId: "FUL-TEE-FOLDED-M", label: "M", priceCents: 3200 },
        { variantId: "FUL-TEE-FOLDED-L", label: "L", priceCents: 3200 },
        { variantId: "FUL-TEE-FOLDED-XL", label: "XL", priceCents: 3600 },
      ],
    },
    aiTemplate: "Render as a soft front-chest graphic tee print, everyday casual tone.",
    customization: {
      sizes: ["S", "M", "L", "XL"],
      colors: ["Olive", "White", "Pink", "Black"],
    },
  },
  {
    id: "hoodieRight",
    name: "Black Hoodie",
    product: "hoodie",
    x: 91,
    y: 46,
    width: 8,
    height: 22,
    silhouette: "shirt",
    description: "Heavyweight hoodie, front-chest portrait print, black garment.",
    estimatedDeliveryDays: [5, 9],
    fulfillment: {
      provider: "printful",
      productId: "FUL-HOODIE-BLACK-PLACEHOLDER",
      printArea: { name: "front chest", x: 28, y: 22, width: 44, height: 34 },
      variants: [
        { variantId: "FUL-HOODIE-BLACK-S", label: "S", priceCents: 5400 },
        { variantId: "FUL-HOODIE-BLACK-M", label: "M", priceCents: 5400 },
        { variantId: "FUL-HOODIE-BLACK-L", label: "L", priceCents: 5400 },
        { variantId: "FUL-HOODIE-BLACK-XL", label: "XL", priceCents: 5800 },
      ],
    },
    aiTemplate: "Render as a front-chest apparel graphic, high contrast, black garment.",
    customization: { sizes: ["S", "M", "L", "XL"], colors: ["Black"] },
  },

  // ---- Tote ----
  {
    id: "tote",
    name: "Tote Bag",
    product: "tote",
    x: 66,
    y: 50,
    width: 8,
    height: 16,
    silhouette: "tote",
    description: "Natural canvas tote, single-color front print.",
    estimatedDeliveryDays: [4, 7],
    fulfillment: {
      provider: "printful",
      productId: "FUL-TOTE-PLACEHOLDER",
      printArea: { name: "front", x: 20, y: 25, width: 60, height: 50 },
      variants: [
        { variantId: "FUL-TOTE-STD", label: "Standard", priceCents: 2800 },
      ],
    },
    aiTemplate: "Render as a single-color screen-print style graphic, natural canvas tote.",
    customization: { colors: ["Natural"] },
  },

  // ---- Non-product hotspots ----
  {
    id: "checkout",
    name: "Checkout",
    product: "checkout",
    x: 46,
    y: 28,
    width: 23,
    height: 18,
    silhouette: "rect",
    // No fulfillment/aiTemplate/customization: opens the cart.
  },
  {
    id: "portraitStudio",
    name: "Portrait Studio",
    product: "upload",
    x: 71,
    y: 41,
    width: 8,
    height: 15,
    silhouette: "rect",
    // Entry point into the AI uploader directly; no fixed product/price.
  },
];
