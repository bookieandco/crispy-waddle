export type PodProductType =
  | "tshirt"
  | "hoodie"
  | "sweatshirt"
  | "mug"
  | "poster"
  | "canvas"
  | "tote"
  | "phone-case"
  | "hat";

export type PrintSurface = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  bleedMm?: number;
  artworkTransform: {
    x: number;
    y: number;
    scale: number;
    rotationDeg: number;
  };
};

export type ProductVariant = {
  id: string;
  label: string;
  sku?: string;
  color?: string;
  size?: string;
  providerVariantId?: string;
  priceCents?: number;
  currency?: string;
};

export type ProductModel = {
  modelUrl?: string;
  thumbnailUrl?: string;
  cameraPreset?: "front" | "three-quarter" | "back" | "detail";
  materialSlots?: string[];
};

export type PodProductDefinition = {
  id: string;
  title: string;
  type: PodProductType;
  description?: string;
  model: ProductModel;
  surfaces: PrintSurface[];
  variants: ProductVariant[];
  provider?: {
    name: "printify" | string;
    productId?: string;
  };
};

export type ProductArtworkComposition = {
  assetId: string;
  surfaceId: string;
  transform?: Partial<PrintSurface["artworkTransform"]>;
};

export const demoProducts: PodProductDefinition[] = [
  {
    id: "classic-tee",
    title: "Classic Tee",
    type: "tshirt",
    description: "A heavyweight everyday tee with a full front print area.",
    model: { cameraPreset: "three-quarter" },
    surfaces: [
      {
        id: "front",
        name: "Front",
        widthMm: 305,
        heightMm: 406,
        bleedMm: 3,
        artworkTransform: { x: 0, y: 0, scale: 1, rotationDeg: 0 },
      },
    ],
    variants: [
      { id: "tee-black-s", label: "Black / S", color: "black", size: "S" },
      { id: "tee-black-m", label: "Black / M", color: "black", size: "M" },
      { id: "tee-black-l", label: "Black / L", color: "black", size: "L" },
      { id: "tee-white-m", label: "White / M", color: "white", size: "M" },
    ],
  },
  {
    id: "classic-hoodie",
    title: "Classic Hoodie",
    type: "hoodie",
    description: "A premium hoodie with a centered front print area.",
    model: { cameraPreset: "three-quarter" },
    surfaces: [
      {
        id: "front",
        name: "Front",
        widthMm: 305,
        heightMm: 406,
        bleedMm: 3,
        artworkTransform: { x: 0, y: 0, scale: 1, rotationDeg: 0 },
      },
    ],
    variants: [
      { id: "hoodie-black-m", label: "Black / M", color: "black", size: "M" },
      { id: "hoodie-black-l", label: "Black / L", color: "black", size: "L" },
    ],
  },
];
