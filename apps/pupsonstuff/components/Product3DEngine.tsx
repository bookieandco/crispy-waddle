'use client';

// Product-specific studio using approved product assets.
import { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  useTexture,
  Center,
  Environment,
  Lightformer,
  RoundedBox,
  Html,
} from '@react-three/drei';
import { Decal } from '@react-three/drei';
import * as THREE from 'three';
import {
  Product3DConfig,
  DecalMap,
  Product3DPlugin,
  Product3DPluginContext,
} from '@/lib/product3d/types';
import Scene3DErrorBoundary from './Scene3DErrorBoundary';
import { prepareProductGeometry } from '@/lib/product3d/geometry';
import { placementBounds } from '@/lib/product3d/placement';
import type { ArtworkTransform } from '@/types/creative';

interface AreaDecalProps {
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  transform?: ArtworkTransform;
  printAreaAspect?: number;
}

/** Isolated so useTexture only ever runs with a real image URL — a print
 * area with nothing generated for it yet simply isn't mounted, rather than
 * being fed a placeholder path that isn't actually an image. */
function AreaDecal({
  url,
  position,
  rotation,
  scale,
  transform,
  printAreaAspect = 1,
}: AreaDecalProps) {
  const texture = useTexture(url);
  const adjustedPosition: [number, number, number] = transform
    ? [
        position[0] + (transform.x - 0.5) * scale,
        position[1] - ((transform.y - 0.5) * scale) / printAreaAspect,
        position[2],
      ]
    : position;
  const adjustedRotation: [number, number, number] = transform
    ? [rotation[0], rotation[1], rotation[2] - (transform.rotation * Math.PI) / 180]
    : rotation;
  const image = texture.image as { width?: number; height?: number };
  const ratio = (image?.width || 1) / (image?.height || 1);
  const bounds = placementBounds(transform ?? {}, ratio, printAreaAspect);
  const adjustedScale: [number, number, number] = [
    scale * bounds.width,
    (scale / printAreaAspect) * bounds.height,
    scale * 0.3,
  ];
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  return (
    <Decal
      position={adjustedPosition}
      rotation={adjustedRotation}
      scale={adjustedScale}
      map={texture}
      map-anisotropy={16}
      depthTest
      polygonOffsetFactor={-4}
    />
  );
}

interface ProductMeshProps {
  config: Product3DConfig;
  color: string;
  decals: DecalMap;
  decalTransforms?: Partial<Record<string, ArtworkTransform>>;
  printAreaAspect?: number;
}

function ProceduralCanvasMesh({
  config,
  decals,
  decalTransforms,
  printAreaAspect,
}: Pick<ProductMeshProps, 'config' | 'decals' | 'decalTransforms' | 'printAreaAspect'>) {
  return (
    <RoundedBox args={[0.75, 1, 0.045]} radius={0.008} smoothness={4} castShadow receiveShadow>
      <meshStandardMaterial color="#f5f0e8" roughness={0.72} />
      {config.printAreas.map((area) => {
        const url = decals[area.name];
        return url ? (
          <AreaDecal
            key={area.name}
            url={url}
            position={area.position}
            rotation={area.rotation}
            scale={area.scale}
            printAreaAspect={printAreaAspect}
            transform={decalTransforms?.[area.name]}
          />
        ) : null;
      })}
    </RoundedBox>
  );
}

type GlbConfig = Product3DConfig &
  Required<Pick<Product3DConfig, 'glbPath' | 'meshName' | 'materialName'>>;

function GlbProductMesh({
  config,
  color,
  decals,
  decalTransforms,
  printAreaAspect,
}: Omit<ProductMeshProps, 'config'> & { config: GlbConfig }) {
  const { nodes, materials } = useGLTF(config.glbPath) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };

  const source = nodes[config.meshName];
  const originalMaterial = materials[config.materialName];
  const geometry = useMemo(
    () =>
      source?.geometry ? prepareProductGeometry(source, config.id, config.modelScale ?? 1) : null,
    [source, config.id, config.modelScale]
  );
  const material = useMemo(() => {
    if (!originalMaterial) return null;
    const copy = originalMaterial.clone();
    if (config.supportsColorChange) copy.color.set(color);
    copy.roughness = config.id === 'mug' ? 0.23 : config.id === 'bottle' ? 0.32 : 0.83;
    copy.metalness = config.id === 'bottle' ? 0.65 : 0;
    return copy;
  }, [originalMaterial, config.id, config.supportsColorChange, color]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material?.dispose(), [material]);

  if (!geometry || !material) {
    console.error(
      `Product3DEngine: mesh "${config.meshName}" or material "${config.materialName}" not found in ${config.glbPath}. Available meshes: ${Object.keys(nodes).join(', ')}`
    );
    throw new Error(`Product asset is incomplete: ${config.id}`);
  }

  const rotation = config.modelRotation ?? [0, 0, 0];

  return (
    <group rotation={rotation}>
      <mesh castShadow geometry={geometry} material={material} dispose={null}>
        {config.printAreas.map((area) => {
          const url = decals[area.name];
          return url ? (
            <AreaDecal
              key={area.name}
              url={url}
              position={area.position}
              rotation={area.rotation}
              scale={area.scale}
              printAreaAspect={printAreaAspect}
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
    return (
      <ProceduralCanvasMesh
        config={config}
        decals={props.decals}
        decalTransforms={props.decalTransforms}
        printAreaAspect={props.printAreaAspect}
      />
    );
  }
  if (!config.glbPath || !config.meshName || !config.materialName) {
    console.error(`Product3DEngine: incomplete GLB config for ${config.id}`);
    return null;
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
  printAreaAspect?: number;
  /** roadmap item 6: extension seam for future capabilities (screenshot export today; text-to-3D/AR later) */
  plugins?: Product3DPlugin[];
}

export default function Product3DEngine({
  config,
  color,
  decals,
  decalTransforms,
  plugins = [],
  printAreaAspect = 1,
}: Props) {
  const anyDecal = Object.values(decals).some(Boolean);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [view, setView] = useState(2);
  useEffect(() => {
    setFailed(false);
    setView(2);
    setSpinning(false);
  }, [config.id]);

  const pluginCtx: Product3DPluginContext = {
    config,
    get canvasElement() {
      return canvasRef.current;
    },
  };

  return (
    <div className="w-full text-ink">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-greige/40 bg-white/40">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">
            3D preview couldn&apos;t load — use the placement preview below.
          </div>
        ) : (
          <Scene3DErrorBoundary
            fallback={
              <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">
                3D preview couldn&apos;t load — use the placement preview below.
              </div>
            }
            onError={() => setFailed(true)}
          >
            <Canvas
              key={`${config.id}:${view}`}
              dpr={[1, 1.75]}
              camera={{
                position:
                  view === 1
                    ? [0, 0, -config.camera.position[2]]
                    : view === 2
                      ? [
                          config.camera.position[2] * 0.7,
                          config.camera.position[2] * 0.25,
                          config.camera.position[2] * 0.7,
                        ]
                      : config.camera.position,
                fov: config.camera.fov ?? 30,
              }}
              gl={{
                preserveDrawingBuffer: true,
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
              }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
            >
              <color attach="background" args={['#f1ece4']} />
              <ambientLight intensity={0.45} />
              <Environment resolution={128}>
                <Lightformer
                  intensity={3}
                  position={[2, 3, 3]}
                  scale={[3, 5, 1]}
                  rotation={[0, -Math.PI / 4, 0]}
                />
                <Lightformer
                  intensity={1.5}
                  position={[-3, 1, 2]}
                  scale={[2, 4, 1]}
                  rotation={[0, Math.PI / 4, 0]}
                />
                <Lightformer intensity={2} position={[0, 3, -3]} scale={[4, 2, 1]} />
              </Environment>
              <directionalLight position={[2, 2, 3]} intensity={0.9} castShadow />
              <directionalLight position={[-2, 1, -1.5]} intensity={0.35} />
              <Suspense
                fallback={
                  <Html center>
                    <span className="text-xs text-ink/60">Loading product…</span>
                  </Html>
                }
              >
                <Center>
                  <ProductMesh
                    config={config}
                    color={color ?? config.defaultColor ?? '#ffffff'}
                    decals={decals}
                    decalTransforms={decalTransforms}
                    printAreaAspect={printAreaAspect}
                  />
                </Center>
              </Suspense>
              <OrbitControls
                enablePan={false}
                minDistance={config.camera.minDistance ?? 1.4}
                maxDistance={config.camera.maxDistance ?? 3.5}
                autoRotate={spinning}
                autoRotateSpeed={0.65}
                enableDamping
                onStart={() => setSpinning(false)}
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

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Product views">
        {['Front', 'Back', 'Detail'].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={view === index}
            onClick={() => setView(index)}
            className="rounded-full border border-greige/60 px-3 py-2 text-xs"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={spinning}
          onClick={() => setSpinning(!spinning)}
          className="rounded-full border border-greige/60 px-3 py-2 text-xs"
        >
          {spinning ? 'Pause rotation' : 'Rotate'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink/50">
        Drag to turn · pinch to zoom. Product visualization; final print proof controls production.
      </p>
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
