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

  mug: {
    id: "mug",
    displayName: "Mug",
    glbPath: "/models/mug.glb",
    meshName: "mug_body",
    materialName: "mug_material",
    // No base color/normal texture — flat gray factor (0.8,0.8,0.8) only,
    // same situation as pillow. Renders flat until the print decal is
    // applied.
    supportsColorChange: true,
    defaultColor: "#f4f4f0",
    // AUDITED (asset-audits/scores/mug.json): 6,008 vertices, 10,682
    // triangles as sourced from `scripts/obj_to_glb.py` (manual OBJ->GLB
    // conversion, no trimesh/Blender CLI available offline). Originally
    // NEEDS_FIXES at 80/100 — 260 zero-area triangles from near-duplicate
    // vertices in the source quads (confirmed not a triangulation-diagonal
    // issue; re-splitting the other way made no difference). Fixed with
    // `scripts/fix_degenerate_triangles.py`, which drops triangles below
    // the audit's own zero-area threshold without moving or removing any
    // vertex — re-audited at 90/100, APPROVED (remaining -10 is 5
    // pre-existing non-manifold edges, unrelated to the fix, informational
    // per the pipeline's own watertightness note).
    //
    // modelRotation: NOT a guess from the ambiguous matplotlib renders
    // (those show it lying on its side regardless of the mesh's real
    // orientation — same rendering-convention mismatch the hoodie's
    // renders had, not evidence on its own). Determined instead by
    // measuring the actual vertex cloud: binning points along each axis
    // and checking which one gives a near-constant, near-circular
    // perpendicular cross-section (std/mean of cross-section radius —
    // Z scored 0.17, X scored 0.41, Y scored 1.0). Z is the mesh's real
    // cylinder axis, confirming this OBJ source is Z-up like the hoodie's
    // Stable Fast 3D export, needing the same -90°-about-X correction.
    // Handle-offset analysis (points at >1.4x the body wall radius) puts
    // the handle in the source +Y direction, which after this rotation
    // maps to -Z — i.e. the handle ends up facing away from a camera on
    // +Z, with the undecorated wall facing it. That's what the print area
    // below is placed on. Still first-pass: confirm live once this
    // actually renders in a browser, per the same caveat as every other
    // model here.
    modelRotation: [-Math.PI / 2, 0, 0],
    camera: {
      position: [0, 0, 0.3],
      fov: 30,
      minDistance: 0.2,
      maxDistance: 0.42,
    },
    printAreas: [
      {
        name: "front",
        position: [0, -0.017, 0.055],
        rotation: [0, 0, 0],
        scale: 0.15,
      },
    ],
  },

  // canvas doesn't need a 3D entry (flat wall art, no product mesh to
  // view). bottle and tote below are the two that did need one.

  bottle: {
    id: "bottle",
    displayName: "Bottle",
    glbPath: "/models/bottle.glb",
    meshName: "bottle_body",
    materialName: "bottle_material",
    // PROCEDURALLY MODELED, not sourced from a photo/reference — real
    // dimensions (20oz bottle: 7.3cm diameter, 27.2cm total height
    // including neck+cap), built with Blender's Python API
    // (scripts/model_product_blender.py) because the intended source
    // (image-to-3D via Hugging Face) is genuinely blocked in this
    // environment — see docs/boutique-design/product-3d-generation.md.
    // AUDITED: 100/100, APPROVED — single continuous lathe/revolve
    // surface (no seams to weld in the first place), real UVs.
    supportsColorChange: true,
    defaultColor: "#bfc2c6",
    // VERIFIED, not a guess: exported bounding box is (0.073, 0.272,
    // 0.073) — Y is the tallest dimension and matches this bottle's own
    // modeled total height (0.20 body + 0.02 shoulder + 0.03 neck +
    // 0.022 cap = 0.272) exactly. Confirms scripts/model_product_blender.py's
    // export_yup=True correctly produced a Y-up mesh — no correction
    // needed, unlike the hoodie/mug's source tools.
    //
    // Y=0 is the VERTICAL CENTER of the bottle (spans -0.136..0.136), not
    // its base — a real bug found live via Playwright, not by the audit
    // (which never checks centering): ProductMesh only ever reads a
    // node's raw `.geometry`, never its node-level translation, so the
    // first export (profile built from z=0 upward, no compensating
    // shift) rendered with OrbitControls' default (0,0,0) target sitting
    // at the bottle's BASE — the camera framed roughly the bottom half
    // and cropped the cap off entirely. Fixed at the source (the
    // Blender profile now starts at -total_height/2), not by fudging the
    // camera/print-area numbers around an off-center mesh.
    modelRotation: [0, 0, 0],
    camera: {
      position: [0, 0, 0.71],
      fov: 30,
      minDistance: 0.46,
      maxDistance: 0.99,
    },
    printAreas: [
      {
        // NOT verified — placeholder centered on the body's front wall.
        // Body spans roughly y=-0.136 (base) to y=0.064 (top of the
        // straight wall, before the shoulder taper starts at
        // body_height=0.20 above the base i.e. 0.20-0.136=0.064); this
        // sits at the vertical midpoint of that wall. Needs confirming
        // against the live mesh before trusting it, same as every other
        // model here.
        name: "front",
        position: [0, -0.036, 0.037],
        rotation: [0, 0, 0],
        scale: 0.1,
      },
    ],
  },

  tote: {
    id: "tote",
    displayName: "Tote",
    glbPath: "/models/tote.glb",
    meshName: "tote_body",
    materialName: "tote_material",
    // PROCEDURALLY MODELED, same tool and same reason as bottle above.
    // Real dimensions (38cm wide, 42cm tall body, 10cm gusset depth),
    // handles Boolean-unioned into the body (real merged solid geometry
    // — confirmed by checking actual vertex counts before/after, not
    // just the audit score, after two earlier passes here that LOOKED
    // fine in a render but were still genuinely disconnected, and a
    // third pass whose handles were oriented flat instead of standing
    // up as an arch — all three real bugs, all caught by actually
    // running the audit/looking at renders, not assumed fixed).
    // AUDITED: 98.8/100, APPROVED.
    supportsColorChange: true,
    defaultColor: "#d9ceae",
    // VERIFIED: exported bounding box is (0.38, 0.518, 0.10) — X matches
    // the modeled width exactly, Z matches the modeled gusset depth
    // exactly, and Y (tallest) matches body height + handle rise
    // (0.42 + 0.098) — confirms Y-up, no rotation needed.
    modelRotation: [0, 0, 0],
    camera: {
      position: [0, 0, 1.35],
      fov: 30,
      minDistance: 0.88,
      maxDistance: 1.89,
    },
    printAreas: [
      {
        // NOT verified — placeholder centered on the front face (body
        // height 0.42, below the handles), needs confirming against the
        // live mesh before trusting it, same as every other model here.
        name: "front",
        position: [0, 0.18, 0.051],
        rotation: [0, 0, 0],
        scale: 0.22,
      },
    ],
  },

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
