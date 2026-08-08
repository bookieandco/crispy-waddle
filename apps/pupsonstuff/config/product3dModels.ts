// config/product3dModels.ts
//
// Every 3D-capable product is registered here, not hardcoded into a
// component. Adding a new model — once you have a real .glb for it — means
// adding an entry here, not touching Product3DEngine.tsx or ProductModal.tsx.
//
// This is a hand-written registry today. The roadmap's "Asset Pipeline"
// (Layer 2) describes generating this metadata automatically alongside
// each new .glb — a real pipeline for that (mesh/material name extraction,
// UV/print-area authoring tooling, camera framing heuristics) is a
// meaningfully bigger build than this single-model registry; this is the
// config FORMAT that pipeline would output, not the pipeline itself.

import { Product3DConfig } from "@/lib/product3d/types";

export const product3DModels: Record<string, Product3DConfig> = {
  shirt: {
    id: "shirt",
    displayName: "T-Shirt",
    glbPath: "/models/shirt_baked.glb",
    meshName: "T_Shirt_male",
    materialName: "lambert1",
    supportsColorChange: true,
    defaultColor: "#f4f4f4",
    camera: {
      position: [0, 0, 2.4],
      fov: 30,
      minDistance: 1.6,
      maxDistance: 3.2,
    },
    printAreas: [
      {
        name: "front",
        position: [0, 0.04, 0.15],
        rotation: [0, 0, 0],
        scale: 0.22,
      },
      // No "back" print area yet — the sourced mesh's UVs for the back
      // panel weren't verified in this pass. Adding one is just another
      // entry here (position/rotation/scale for that spot on the mesh),
      // once someone's actually checked it lines up.
    ],
  },

  hoodie: {
    id: "hoodie",
    displayName: "Hoodie",
    glbPath: "/models/hoodie.glb",
    meshName: "hoodie_body",
    materialName: "hoodie_material",
    // Whether this material responds to color tinting the way the shirt's
    // does wasn't verified — it has its own baked base-color + normal map
    // (see the audit), so a flat color multiply may look wrong. Defaulting
    // off until checked visually.
    supportsColorChange: false,
    // AUDITED, from a real Stable Fast 3D output (see README for the full
    // report): 12,303 vertices, 21,044 triangles, UVs + normals present,
    // 1024x1024 base color + normal map textures, not watertight (open
    // seams — fine for a visual/web preview, would matter for manufacturing
    // or physical 3D printing), single connected surface once coincident
    // UV-seam vertices are welded (an earlier pass flagged "407 disconnected
    // components" as the biggest concern — that number came from counting
    // by shared vertex INDEX, which double-counts every UV seam; by actual
    // position it's one coherent mesh).
    //
    // NOT verified: the corrective rotation and print-area placement below
    // are first-pass estimates from static renders (matplotlib, not the
    // real Three.js/drei pipeline) — the raw mesh comes oriented lying
    // flat (Stable Fast 3D's Z-up-ish export), and this rotates it to
    // stand upright the way Y-up glTF viewers expect. Confirm both once
    // this actually renders in a browser; don't treat these numbers as
    // final until someone's looked at it live.
    modelRotation: [-Math.PI / 2, 0, 0],
    camera: {
      position: [0, 0, 2.4],
      fov: 30,
      minDistance: 1.6,
      maxDistance: 3.4,
    },
    printAreas: [
      {
        name: "front",
        position: [0, 0.05, 0.13],
        rotation: [0, 0, 0],
        scale: 0.2,
      },
    ],
  },

  // Mug, tote, canvas, etc. all need their own real .glb before an entry
  // here does anything — registering a config against a mesh that doesn't
  // exist just produces a load error, not a placeholder model.

  pillow: {
    id: "pillow",
    displayName: "Pillow",
    glbPath: "/models/pillow.glb",
    meshName: "Box001",
    materialName: "Material",
    // No base color or normal texture on this material at all — just a
    // flat gray baseColorFactor. Renders as flat/untextured until a real
    // print-area decal is applied; don't expect fabric weave detail from
    // the base material itself (an earlier render made it LOOK textured,
    // but that was the mesh's own triangulation density showing through
    // this project's flat-shaded audit renderer, not an actual texture map).
    supportsColorChange: true,
    defaultColor: "#e8e8e8",
    // AUDITED: 2,170 vertices, 3,840 triangles — lighter than shirt/hoodie,
    // good for mobile. UVs + normals present, 0 degenerate triangles,
    // single connected surface once welded. Not watertight (488 boundary
    // edges) — fine for a visual preview per the same reasoning as the
    // other assets. Silhouette confirmed genuinely pillow-shaped (puffy
    // cushion volume, pinched corners) from the front/perspective renders
    // with NO rotation correction needed — unlike the hoodie, this one
    // came in already oriented upright.
    //
    // This asset's units are ~100x larger than the shirt/hoodie's (bounding
    // box ~109 x 42 x 108 vs. their ~0.2-0.9 range) — a different source
    // pipeline, different unit convention. modelScale below normalizes it
    // into the same rough range as the other products so camera/print-area
    // values stay comparable if this ever needs to sit in a shared scene.
    modelScale: 0.008,
    camera: {
      position: [0, 0, 2.4],
      fov: 30,
      minDistance: 1.5,
      maxDistance: 3.5,
    },
    printAreas: [
      {
        // NOT verified — placeholder centered on the front face, needs
        // confirming against the actual UVs live before trusting it.
        name: "front",
        position: [0, 0, 0.17],
        rotation: [0, 0, 0],
        scale: 0.5,
      },
    ],
  },
};

export function getProduct3DConfig(id: string): Product3DConfig | null {
  return product3DModels[id] ?? null;
}
