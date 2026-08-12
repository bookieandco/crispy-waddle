export type PhysicsProvider = "duik" | "rigid-body" | "cloth-sim" | "physics-fallback";

export interface PhysicsMaterial {
  id: string;
  kind: "cloth" | "leather" | "metal" | "glass" | "plastic" | "wood" | "rubber" | "paper";
  massKg: number;
  friction: number;
  restitution: number;
  stiffness: number;
  damping: number;
}

export interface PhysicsBody {
  id: string;
  materialId: string;
  massKg: number;
  collisionShape: "box" | "sphere" | "capsule" | "mesh";
  dynamic: boolean;
  kinematic?: boolean;
}

export interface ClothConstraint {
  garmentId: string;
  characterId: string;
  materialId: string;
  pinnedBones: string[];
  stretchLimit: number;
  bendResistance: number;
  collisionThickness: number;
  windResponse: number;
}

export interface PhysicsScene {
  gravity: { x: number; y: number; z: number };
  bodies: PhysicsBody[];
  cloth: ClothConstraint[];
  materials: PhysicsMaterial[];
}

export interface PhysicsProviderAdapter {
  readonly name: PhysicsProvider;
  isAvailable(): Promise<boolean>;
  simulate(scene: PhysicsScene, durationMs: number): Promise<{ outputId: string; warnings: string[] }>;
}

export function defaultHumanPhysicsScene(): PhysicsScene {
  return {
    gravity: { x: 0, y: -9.81, z: 0 },
    materials: [
      { id: "default-cloth", kind: "cloth", massKg: 0.5, friction: 0.6, restitution: 0.05, stiffness: 0.35, damping: 0.25 },
      { id: "default-rigid", kind: "plastic", massKg: 1, friction: 0.5, restitution: 0.15, stiffness: 1, damping: 0.1 },
    ],
    bodies: [],
    cloth: [],
  };
}
