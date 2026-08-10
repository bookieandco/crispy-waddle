export type LoRACategory = "character" | "voice" | "clothing" | "hair" | "style" | "environment" | "behavior";

export interface LoRAAdapter {
  id: string;
  name: string;
  category: LoRACategory;
  provider: "cloneofsimo" | "lora-scripts" | "lorax" | "custom";
  modelBase: string;
  artifactUri: string;
  weight: number;
  version: string;
  approved: boolean;
  provenance?: string;
}

export interface LoRAStack {
  characterId?: string;
  adapters: LoRAAdapter[];
  seed?: number;
}

export function validateLoRAStack(stack: LoRAStack): string[] {
  const warnings: string[] = [];
  for (const adapter of stack.adapters) {
    if (!adapter.approved) warnings.push(`Adapter ${adapter.id} is not approved.`);
    if (adapter.weight < 0 || adapter.weight > 2) warnings.push(`Adapter ${adapter.id} weight is outside the supported 0..2 range.`);
    if (!adapter.artifactUri) warnings.push(`Adapter ${adapter.id} has no artifact URI.`);
  }
  return warnings;
}

export function sortForApplication(stack: LoRAStack): LoRAAdapter[] {
  const order: Record<LoRACategory, number> = { character: 10, voice: 20, clothing: 30, hair: 40, behavior: 50, environment: 60, style: 70 };
  return [...stack.adapters].sort((a, b) => order[a.category] - order[b.category]);
}
