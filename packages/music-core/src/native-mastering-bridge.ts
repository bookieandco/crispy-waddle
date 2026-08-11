import type { MasteringPlan, MasteringStep } from "./mastering";

export interface NativeEqBand { frequencyHz: number; gainDb: number; q: number; }
export interface NativeMasteringCommand { operation: "eq" | "limiter"; eq?: NativeEqBand; ceilingDbtp?: number; sourceStepId: string; }
export interface NativeMasteringBridge { apply(command: NativeMasteringCommand): void; }

export function masteringStepToNativeCommand(step: MasteringStep): NativeMasteringCommand | null {
  if (step.operation === "eq") {
    const frequencyHz = numberParameter(step.parameters.frequencyHz);
    const gainDb = numberParameter(step.parameters.gainDb);
    const q = numberParameter(step.parameters.q);
    if (frequencyHz !== undefined && gainDb !== undefined && q !== undefined) {
      return { operation: "eq", eq: { frequencyHz, gainDb, q }, sourceStepId: step.id };
    }
    return null;
  }
  if (step.operation === "limiter") {
    const ceilingDbtp = numberParameter(step.parameters.ceilingDbtp);
    if (ceilingDbtp !== undefined) return { operation: "limiter", ceilingDbtp, sourceStepId: step.id };
  }
  return null;
}

export function compileMasteringPlanToNativeCommands(plan: MasteringPlan): NativeMasteringCommand[] {
  return plan.steps.slice().sort((a, b) => a.priority - b.priority).map(masteringStepToNativeCommand)
    .filter((command): command is NativeMasteringCommand => command !== null);
}

function numberParameter(value: string | number | boolean | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
