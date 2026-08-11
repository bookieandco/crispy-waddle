import type { EvolutionRepairRuntime } from "@jhadina/evolution-core/evolution-repair-runtime";

let runtime: EvolutionRepairRuntime | undefined;

export function registerEvolutionRepairRuntime(value: EvolutionRepairRuntime): void {
  runtime = value;
}

export function getEvolutionRepairRuntime(): EvolutionRepairRuntime {
  if (!runtime) {
    throw new Error("Jhadina evolution repair runtime is not configured on this server");
  }
  return runtime;
}
