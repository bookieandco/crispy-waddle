"use client";

// Product3DEngine — the generic viewer the roadmap asked for. Replaces the
// old hardcoded Product3DPreview.tsx: this takes a Product3DConfig (see
// config/product3dModels.ts) instead of assuming any specific model, mesh
// name, or single decal spot.
//
// Known limitation, stated plainly: this only handles single-mesh,
// single-material .glb files (reads exactly one geometry + one material
// off the loaded GLTF). Both models registered so far (shirt, hoodie)
// happen to fit that. A garment with separate meshes per panel, or
// multiple materials, needs this extended — not a large change, but not
// done yet, so don't assume it "just works" for an arbitrary future asset.

import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { Decal } from "@react-three/drei";
import * as THREE from "three";
import {
  Product3DConfig,
  DecalMap,
  Product3DPlugin,
  Product3DPluginContext,
} from "@/lib/product3d/types";
import Scene3DErrorBoundary from "./Scene3DErrorBoundary";

interface AreaDecalProps {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

/** Isolated so useTexture only ever runs with a real image URL — a print
 * area with nothing generated for it yet simply isn't mounted, rather than
 * being fed a placeholder path that isn't actually an image. */
function AreaDecal({ url, position, rotation, scale }: AreaDecalProps) {
  const texture = useTexture(url);
  return (
    <Decal
      position={position}
      rotation={rotation}
      scale={scale}
      map={texture}
      map-anisotropy={16}
      depthTest={false}
      // drei 10's DecalProps dropped the top-level `depthWrite` prop (it
      // was never namespaced as `material-depthWrite`, so it wasn't
      // actually reaching the decal's material even before this upgrade —
      // PBR materials default to depthWrite:true regardless, which is the
      // behavior this line intended). Nothing to replace it with; removed.
    />
  );
}

interface ProductMeshProps {
  config: Product3DConfig;
  color: string;
  decals: DecalMap;
}

function ProductMesh({ config, color, decals }: ProductMeshProps) {
  const { nodes, materials } = useGLTF(config.glbPath) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };

  const geometry = nodes[config.meshName]?.geometry;
  const material = materials[config.materialName];

  if (!geometry || !material) {
    // Config/asset mismatch — fail loudly in dev rather than silently
    // rendering nothing, since this means the .glb's actual mesh/material
    // names don't match what's registered in config/product3dModels.ts.
    console.error(
      `Product3DEngine: mesh "${config.meshName}" or material "${config.materialName}" not found in ${config.glbPath}. Available meshes: ${Object.keys(nodes).join(", ")}`
    );
    return null;
  }

  const rotation = config.modelRotation ?? [0, 0, 0];
  const scale = config.modelScale ?? 1;

  return (
    <group rotation={rotation} scale={scale}>
      <mesh
        castShadow
        geometry={geometry}
        material={material}
        material-color={config.supportsColorChange ? color : undefined}
        material-roughness={1}
        dispose={null}
      >
        {config.printAreas.map((area) => {
          const url = decals[area.name];
          return url ? (
            <AreaDecal
              key={area.name}
              url={url}
              position={area.position}
              rotation={area.rotation}
              scale={area.scale}
            />
          ) : null;
        })}
      </mesh>
    </group>
  );
}

interface Props {
  config: Product3DConfig;
  /** hex color, only applied if config.supportsColorChange */
  color?: string;
  /** map of print-area name -> generated texture URL (or null if not generated yet) */
  decals: DecalMap;
  /** roadmap item 6: extension seam for future capabilities (screenshot export today; text-to-3D/AR later) */
  plugins?: Product3DPlugin[];
}

export default function Product3DEngine({
  config,
  color,
  decals,
  plugins = [],
}: Props) {
  const anyDecal = Object.values(decals).some(Boolean);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  const pluginCtx: Product3DPluginContext = {
    config,
    get canvasElement() {
      return canvasRef.current;
    },
  };

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-greige/40 bg-white/40">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">
            3D preview couldn&apos;t load — try the flat preview instead.
          </div>
        ) : (
          <Scene3DErrorBoundary
            fallback={
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">
                3D preview couldn&apos;t load — try the flat preview instead.
              </div>
            }
            onError={() => setFailed(true)}
          >
            <Canvas
              camera={{
                position: config.camera.position,
                fov: config.camera.fov ?? 30,
              }}
              gl={{ preserveDrawingBuffer: true }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
            >
              {/* Real lights only — no <Environment preset> here. That
                  component fetches an HDR file from an external CDN, and
                  the first time this was actually driven end-to-end in a
                  browser (not just built), a blocked/slow fetch for it
                  crashed the whole app with an uncaught error, not just a
                  duller-looking product. A three-point-ish rig (ambient
                  fill + a stronger key light + a soft opposite fill)
                  costs nothing over the network and reads as "lit
                  product photo" well enough without reflections that
                  depend on a resource this app doesn't control the
                  availability of. */}
              <ambientLight intensity={0.55} />
              <directionalLight position={[2, 2, 3]} intensity={0.9} castShadow />
              <directionalLight position={[-2, 1, -1.5]} intensity={0.35} />
              <Suspense fallback={null}>
                <ProductMesh
                  config={config}
                  color={color ?? config.defaultColor ?? "#ffffff"}
                  decals={decals}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                minDistance={config.camera.minDistance ?? 1.4}
                maxDistance={config.camera.maxDistance ?? 3.5}
                autoRotate
                autoRotateSpeed={1.4}
              />
            </Canvas>
          </Scene3DErrorBoundary>
        )}
        {!anyDecal && !failed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-ink/50">
            Generate a preview to see it on the {config.displayName.toLowerCase()}
          </div>
        )}
      </div>

      {plugins.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {plugins.map((plugin) => (
            <div key={plugin.id}>{plugin.renderControls?.(pluginCtx)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
