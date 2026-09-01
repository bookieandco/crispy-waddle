import type { PodProductDefinition } from "@jhadina/pod-product-core";

/** Renderer-ready product definition for the first vertical slice. */
export const demoTShirt: PodProductDefinition = {
  id: "demo-tshirt",
  type: "apparel",
  title: "Classic T-Shirt",
  model: { kind: "gltf", url: "/models/products/classic-tshirt.glb" },
  printableSurfaces: [
    {
      id: "front",
      label: "Front",
      widthInches: 12,
      heightInches: 16,
      defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
    },
    {
      id: "back",
      label: "Back",
      widthInches: 12,
      heightInches: 16,
      defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
    },
  ],
  variants: [
    { id: "black-s", title: "Black / S", color: "black", size: "S" },
    { id: "black-m", title: "Black / M", color: "black", size: "M" },
    { id: "black-l", title: "Black / L", color: "black", size: "L" },
    { id: "white-s", title: "White / S", color: "white", size: "S" },
    { id: "white-m", title: "White / M", color: "white", size: "M" },
    { id: "white-l", title: "White / L", color: "white", size: "L" },
  ],
  cameraPresets: [
    { id: "front", label: "Front" },
    { id: "back", label: "Back" },
    { id: "three-quarter", label: "3/4" },
  ],
};
