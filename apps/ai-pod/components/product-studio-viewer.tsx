"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { ViewerRenderModel } from "../lib/3d/viewer-adapter";

function ProductModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} />;
}

export function ProductStudioViewer({
  model,
}: {
  model: ViewerRenderModel;
}) {
  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl bg-neutral-100">
      <Canvas camera={{ position: [0, 0, 3], fov: 35 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <ProductModel modelUrl={model.modelUrl} />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
