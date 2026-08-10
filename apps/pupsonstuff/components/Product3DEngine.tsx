"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture, Decal } from "@react-three/drei";
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
    />
  );
}

interface ProductMeshProps {
  config: Product3DConfig;
  color: string;
  decals: DecalMap;
  focused: boolean;
  onFocus: () => void;
}

function ProductMesh({ config, color, decals, focused, onFocus }: ProductMeshProps) {
  const { nodes, materials } = useGLTF(config.glbPath) as unknown as {
    nodes: Record<string, THREE.Mesh>;
    materials: Record<string, THREE.MeshStandardMaterial>;
  };
  const geometry = nodes[config.meshName]?.geometry;
  const sourceMaterial = materials[config.materialName];
  const material = useMemo(() => sourceMaterial?.clone(), [sourceMaterial]);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = focused ? 1.12 : hovered ? 1.055 : 1;
    const next = THREE.MathUtils.damp(groupRef.current.scale.x, target, 7, delta);
    groupRef.current.scale.setScalar(next);
  });

  if (!geometry || !material) {
    console.error(
      `Product3DEngine: mesh "${config.meshName}" or material "${config.materialName}" not found in ${config.glbPath}. Available meshes: ${Object.keys(nodes).join(", ")}`
    );
    return null;
  }

  const rotation = config.modelRotation ?? [0, 0, 0];
  const baseScale = config.modelScale ?? 1;
  material.color.set(config.supportsColorChange ? color : "#ffffff");
  material.roughness = focused ? 0.72 : 0.9;
  material.emissive.set(hovered || focused ? "#6b4f2a" : "#000000");
  material.emissiveIntensity = hovered ? 0.035 : focused ? 0.08 : 0;

  return (
    <group ref={groupRef} rotation={rotation} scale={baseScale}>
      <mesh
        castShadow
        geometry={geometry}
        material={material}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(event) => {
          event.stopPropagation();
          onFocus();
        }}
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

function FocusCamera({ focused, controlsRef }: { focused: boolean; controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const destination = focused
      ? new THREE.Vector3(0, 0.05, 2.15)
      : new THREE.Vector3(0, 0, 3);
    camera.position.lerp(destination, 1 - Math.exp(-5 * delta));
    target.current.lerp(focused ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0, 0), 1 - Math.exp(-5 * delta));
    camera.lookAt(target.current);
    if (controlsRef.current) controlsRef.current.enabled = !focused;
  });

  return null;
}

interface Props {
  config: Product3DConfig;
  color?: string;
  decals: DecalMap;
  plugins?: Product3DPlugin[];
}

export default function Product3DEngine({ config, color, decals, plugins = [] }: Props) {
  const anyDecal = Object.values(decals).some(Boolean);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [focused, setFocused] = useState(false);

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
            fallback={<div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-ink/50">3D preview couldn&apos;t load — try the flat preview instead.</div>}
            onError={() => setFailed(true)}
          >
            <Canvas
              camera={{ position: config.camera.position, fov: config.camera.fov ?? 30 }}
              gl={{ preserveDrawingBuffer: true }}
              shadows
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
            >
              <ambientLight intensity={focused ? 0.72 : 0.55} />
              <directionalLight position={[2, 2, 3]} intensity={focused ? 1.25 : 0.9} castShadow />
              <directionalLight position={[-2, 1, -1.5]} intensity={focused ? 0.5 : 0.35} />
              <Suspense fallback={null}>
                <ProductMesh
                  config={config}
                  color={color ?? config.defaultColor ?? "#ffffff"}
                  decals={decals}
                  focused={focused}
                  onFocus={() => setFocused((value) => !value)}
                />
              </Suspense>
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                minDistance={config.camera.minDistance ?? 1.4}
                maxDistance={config.camera.maxDistance ?? 3.5}
                autoRotate={!focused}
                autoRotateSpeed={1.4}
              />
              <FocusCamera focused={focused} controlsRef={controlsRef} />
            </Canvas>
          </Scene3DErrorBoundary>
        )}
        {!anyDecal && !failed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-ink/50">Generate a preview to see it on the {config.displayName.toLowerCase()}</div>
        )}
        {focused && !failed && (
          <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-xs font-medium text-bronze">Product reveal · tap again to return</div>
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
