"use client";

// BoutiqueScene — the environment-level 3D scene (Milestone 6). This is a
// deliberately different tier from Product3DEngine: that component shows
// ONE product in its own isolated <Canvas>; this one shows the ROOM, with
// product hotspots as markers inside it that hand off to the exact same
// Product3DEngine/ProductModal already used by the flat-photo experience.
// No product mesh is ever loaded or rendered directly by this file — see
// Boutique.tsx, which still owns ProductModal and passes it the same
// onSelect callback the 2D Hotspots component already uses.

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { hotspots, Hotspot as HotspotConfig } from "@/data/hotspots";
import {
  BOUTIQUE_HOTSPOTS_3D,
  BOUTIQUE_SHELL_PATH,
  STARTING_CAMERA,
  shellMeta,
} from "@/config/boutiqueShell";

const hotspotById = new Map(hotspots.map((h) => [h.id, h]));

function BoutiqueShellModel() {
  const { scene } = useGLTF(BOUTIQUE_SHELL_PATH);
  // Cloned rather than rendered directly — useGLTF caches and shares the
  // same Object3D across every call for this URL; cloning keeps this
  // scene instance safe to mount/unmount independently of that cache
  // (e.g. switching back and forth between flat/3D mode) without fighting
  // over a single shared parent.
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} />;
}

/** Two real point lights, one per track-lighting rail, positioned at each
 * rail's middle head — not one light per decorative head. 12 real-time
 * lights would be real GPU cost on a phone for illumination the room
 * doesn't need that granularly; 2 lights plus ambient/hemisphere fill
 * reads as "track-lit room" without paying for 12. The decorative rail +
 * head geometry (all 12) still comes from the .glb unchanged — this only
 * decides what actually emits light. */
function BoutiqueLighting() {
  const leftRailHeads = shellMeta.lightHeads.filter((p) => p[0] < 0);
  const rightRailHeads = shellMeta.lightHeads.filter((p) => p[0] >= 0);
  const mid = (pts: number[][]) => pts[Math.floor(pts.length / 2)] as [number, number, number];

  return (
    <>
      <ambientLight intensity={0.45} color="#fff2df" />
      <hemisphereLight
        color="#fff6ea"
        groundColor="#3a2c1d"
        intensity={0.35}
      />
      {leftRailHeads.length > 0 && (
        <pointLight
          position={mid(leftRailHeads)}
          intensity={12}
          distance={6}
          decay={2}
          color="#ffe3b0"
        />
      )}
      {rightRailHeads.length > 0 && (
        <pointLight
          position={mid(rightRailHeads)}
          intensity={12}
          distance={6}
          decay={2}
          color="#ffe3b0"
        />
      )}
      {/* Soft warm glow near the back accent wall / counter — matches the
          photo's "register area" focused pool of light. */}
      <pointLight
        position={[0, shellMeta.ceilingHeightMeters - 0.5, shellMeta.counter.center[2] + 0.6]}
        intensity={6}
        distance={5}
        decay={2}
        color="#ffedcf"
      />
    </>
  );
}

interface MarkerProps {
  hotspot: HotspotConfig;
  position: [number, number, number];
  onSelect: (hotspot: HotspotConfig) => void;
}

function ProductMarker({ hotspot, position, onSelect }: MarkerProps) {
  return (
    <group position={position}>
      <Html
        center
        distanceFactor={6}
        occlude={false}
        zIndexRange={[10, 0]}
      >
        <button
          type="button"
          onClick={() => onSelect(hotspot)}
          aria-label={hotspot.name}
          className="flex flex-col items-center gap-1 rounded-full bg-ink/70 px-3 py-2 text-cream shadow-gold-glow backdrop-blur-sm transition hover:bg-ink/90 active:scale-95"
          style={{ touchAction: "manipulation" }}
        >
          <span className="h-2 w-2 rounded-full bg-gold shadow-gold-glow" />
          <span className="whitespace-nowrap text-[11px] font-medium leading-none">
            {hotspot.name}
          </span>
        </button>
      </Html>
    </group>
  );
}

function RoomBounds({ onReady }: { onReady?: () => void }) {
  const ready = useRef(false);
  if (!ready.current) {
    ready.current = true;
    onReady?.();
  }
  return null;
}

interface Props {
  onSelectHotspot: (hotspot: HotspotConfig) => void;
  onReady?: () => void;
}

export default function BoutiqueScene({ onSelectHotspot, onReady }: Props) {
  const { x0, x1, z0, z1 } = shellMeta.roomBounds;
  // Keep the orbit camera physically inside the room: never past the
  // walls/ceiling/floor, and never so far out it clips through them.
  const maxRadius = Math.min(
    Math.max(x1 - x0, z1 - z0) * 0.48,
    shellMeta.ceilingHeightMeters * 1.4
  );

  return (
    <Canvas
      dpr={[1, 1.75]} // capped devicePixelRatio — mobile fill-rate guard
      // fov 75 (not the more "realistic" ~50-60) is a deliberate, measured
      // choice, not an arbitrary wide-angle look: on a portrait phone
      // viewport, horizontal FOV is roughly HALF the vertical FOV (it
      // shrinks with aspect ratio), so a 60° vertical FOV left several
      // product markers outside the starting frame entirely — confirmed
      // by an actual screenshot during testing, not assumed. 75° is the
      // narrowest value that keeps every hand-placed marker (config/
      // boutiqueShell.ts's ±1.6m band) inside the frame at their real
      // depth from STARTING_CAMERA, on a real portrait mobile aspect
      // ratio, checked against the same math.
      camera={{ position: STARTING_CAMERA.position, fov: 75, near: 0.05, far: 50 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      // No `shadows` prop here (unlike Product3DEngine's per-product
      // canvas) — real-time shadow maps over a whole room are real GPU
      // cost this environment-level scene deliberately doesn't spend.
    >
      <Suspense fallback={null}>
        <BoutiqueShellModel />
        <BoutiqueLighting />
        {BOUTIQUE_HOTSPOTS_3D.map(({ hotspotId, position }) => {
          const hotspot = hotspotById.get(hotspotId);
          if (!hotspot) return null;
          return (
            <ProductMarker
              key={hotspotId}
              hotspot={hotspot}
              position={position}
              onSelect={onSelectHotspot}
            />
          );
        })}
        <RoomBounds onReady={onReady} />
      </Suspense>
      <OrbitControls
        target={STARTING_CAMERA.target}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        minDistance={0.6}
        maxDistance={maxRadius}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        // Default three.js touch mapping already gives one-finger =
        // rotate/look, two-finger pinch = dolly (zoom) — this just turns
        // pan off so a two-finger drag doesn't strafe the camera through
        // a wall.
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}

useGLTF.preload(BOUTIQUE_SHELL_PATH);
