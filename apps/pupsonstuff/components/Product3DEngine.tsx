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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { Decal } from "@react-three/drei";
import * as THREE from "three";
import {
  Product3DConfig,
  PrintArea,
  DecalMap,
  Product3DPlugin,
  Product3DPluginContext,
} from "@/lib/product3d/types";
import Scene3DErrorBoundary from "./Scene3DErrorBoundary";
import type { ArtworkTransform } from "@/types/creative";
import { getDecalPlacement } from "@/lib/product3d/placement";
import { toneProductMaterial } from "@/lib/product3d/material";

interface AreaDecalProps {
  url: string;
  area: PrintArea;
  transform?: ArtworkTransform;
}

/** Isolated so useTexture only ever runs with a real image URL — a print
 * area with nothing generated for it yet simply isn't mounted, rather than
 * being fed a placeholder path that isn't actually an image. */
function AreaDecal({ url, area, transform }: AreaDecalProps) {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  const placement = useMemo(() => getDecalPlacement(area, transform), [area, transform]);
  return (
    <Decal
      position={placement.position}
      rotation={placement.rotation}
      scale={placement.scale}
      map={texture}
      map-anisotropy={8}
      depthTest
    />
  );
}

interface ProductMeshProps {
  config: Product3DConfig;
  color: string;
  decals: DecalMap;
  decalTransforms?: Partial<Record<string, ArtworkTransform>>;
  onReady: () => void;
}

function ProceduralCanvasMesh({
  config,
  decals,
  decalTransforms,
  onReady,
}: Pick<ProductMeshProps, 'config' | 'decals' | 'decalTransforms' | 'onReady'>) {
  useEffect(() => onReady(), [onReady]);
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.75, 1, 0.08]} />
      <meshStandardMaterial color="#f5f0e8" roughness={0.72} />
      {config.printAreas.map((area) => {
        const url = decals[area.name];
        return url ? (
          <AreaDecal
            key={area.name}
            url={url}
            area={area}
            transform={decalTransforms?.[area.name]}
          />
        ) : null;
      })}
    </mesh>
  );
}

type GlbConfig = Product3DConfig &
  Required<Pick<Product3DConfig, 'glbPath' | 'meshName' | 'materialName'>>;

function GlbProductMesh({
  config,
  color,
  decals,
  decalTransforms,
  onReady,
}: Omit<ProductMeshProps, 'config'> & { config: GlbConfig }) {
  const { nodes, materials } = useGLTF(config.glbPath) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };

  const geometry = nodes[config.meshName]?.geometry;
  const sourceMaterial = materials[config.materialName];
  // useGLTF caches materials across viewers. Never recolor the shared source.
  const material = useMemo(() => sourceMaterial?.clone(), [sourceMaterial]);
  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => {
    if (!material) return;
    toneProductMaterial(material, config, color);
  }, [material, color, config]);
  // Center raw geometry and its child decals together. Config print
  // positions remain in raw GLB mesh-space, not post-centering coordinates.
  const meshPosition = useMemo((): [number, number, number] => {
    if (!geometry) return [0, 0, 0];
    geometry.computeBoundingBox();
    const center = geometry.boundingBox?.getCenter(new THREE.Vector3());
    return center ? [-center.x, -center.y, -center.z] : [0, 0, 0];
  }, [geometry]);

  useEffect(() => {
    if (geometry && material) onReady();
  }, [geometry, material, onReady]);

  if (!geometry || !material) {
    throw new Error(
      `3D model mismatch in ${config.glbPath}: expected mesh ${config.meshName}, material ${config.materialName}; available meshes: ${Object.keys(nodes).join(", ")}`
    );
  }

  const rotation = config.modelRotation ?? [0, 0, 0];
  const scale = config.modelScale ?? 1;

  return (
    <group rotation={rotation} scale={scale}>
      <mesh
        castShadow
        geometry={geometry}
        material={material}
        position={meshPosition}
        dispose={null}
      >
        {config.printAreas.map((area) => {
          const url = decals[area.name];
          return url ? (
            <AreaDecal
              key={area.name}
              url={url}
              area={area}
              transform={decalTransforms?.[area.name]}
            />
          ) : null;
        })}
      </mesh>
    </group>
  );
}

function ProductMesh(props: ProductMeshProps) {
  const { config } = props;
  if (config.primitive === 'canvas') {
    return <ProceduralCanvasMesh config={config} decals={props.decals} decalTransforms={props.decalTransforms} onReady={props.onReady} />;
  }
  if (!config.glbPath || !config.meshName || !config.materialName) {
    throw new Error(`Product3DEngine: incomplete GLB config for ${config.id}`);
  }
  return <GlbProductMesh {...props} config={config as GlbConfig} />;
}

interface Props {
  config: Product3DConfig;
  /** hex color, only applied if config.supportsColorChange */
  color?: string;
  /** map of print-area name -> generated texture URL (or null if not generated yet) */
  decals: DecalMap;
  /** optional shopper placement transform per print area */
  decalTransforms?: Partial<Record<string, ArtworkTransform>>;
  /** roadmap item 6: extension seam for future capabilities (screenshot export today; text-to-3D/AR later) */
  plugins?: Product3DPlugin[];
}

export default function Product3DEngine({
  config,
  color,
  decals,
  decalTransforms,
  plugins = [],
}: Props) {
  const anyDecal = Object.values(decals).some(Boolean);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const markReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    setFailed(false);
    setReady(false);
    setRetryCount(0);
  }, [config.id, config.glbPath]);
  useEffect(() => {
    if (!canvasElement) return;
    const onContextLost = (event: Event) => {
      // Ensure the browser can restore the context on the next viewer attempt.
      event.preventDefault();
      setReady(false);
      setFailed(true);
    };
    canvasElement.addEventListener('webglcontextlost', onContextLost);
    return () => canvasElement.removeEventListener('webglcontextlost', onContextLost);
  }, [canvasElement]);

  const pluginCtx: Product3DPluginContext = {
    config,
    get canvasElement() {
      return canvasRef.current;
    },
  };

  const reloadViewer = (clearAsset: boolean) => {
    if (clearAsset && config.glbPath) useGLTF.clear(config.glbPath);
    canvasRef.current = null;
    setCanvasElement(null);
    setReady(false);
    setRetryCount((count) => count + 1);
    setFailed(false);
  };

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-greige/40 bg-white/40">
        {failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-ink/60" role="status">
            <p>3D model unavailable. Your portrait artwork can still be viewed using the Artwork tab.</p>
            <button
              type="button"
              className="rounded-full border border-greige/60 bg-cream px-4 py-2 text-xs font-medium text-ink"
              onClick={() => reloadViewer(true)}
            >Try 3D again</button>
          </div>
        ) : (
          <Scene3DErrorBoundary
            key={`${config.id}:${retryCount}`}
            fallback={
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">
                3D preview couldn&apos;t load — use the placement preview below.
              </div>
            }
            onError={() => setFailed(true)}
          >
            <Canvas
              key={`${config.id}:${retryCount}`}
              dpr={[1, 1.5]}
              camera={{
                position: config.camera.position,
                fov: config.camera.fov ?? 30,
              }}
              gl={{ preserveDrawingBuffer: true, powerPreference: "low-power" }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
                setCanvasElement(gl.domElement);
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
                  decalTransforms={decalTransforms}
                  onReady={markReady}
                />
              </Suspense>
              <OrbitControls
                enablePan={false}
                minDistance={config.camera.minDistance ?? 1.4}
                maxDistance={config.camera.maxDistance ?? 3.5}
                autoRotate={!anyDecal}
                autoRotateSpeed={0.7}
              />
            </Canvas>
          </Scene3DErrorBoundary>
        )}
        {!failed && !ready && (
          <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs text-ink/70" role="status" aria-live="polite">
            Loading {config.displayName.toLowerCase()} 3D model…
          </div>
        )}
        {!failed && ready && (
          <button
            type="button"
            onClick={() => reloadViewer(false)}
            className="absolute right-3 top-3 rounded-full border border-greige/40 bg-cream/85 px-3 py-2 text-xs font-medium text-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-bronze"
            aria-label="Reset 3D camera"
          >Reset view</button>
        )}
        {!anyDecal && !failed && ready && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-ink/50">
            Generate a preview to see it on the {config.displayName.toLowerCase()}
          </div>
        )}
      </div>

      {!failed && ready && plugins.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {plugins.map((plugin) => (
            <div key={plugin.id}>{plugin.renderControls?.(pluginCtx)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
