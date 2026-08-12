export type EvolutionCommand =
  | { kind: "audit"; target: "system" | "bug"; request: string }
  | { kind: "fix"; target: "system" | "bug" | "money-core"; request: string }
  | { kind: "upgrade"; target: "system" | "money-core"; request: string }
  | { kind: "apply"; request: string }
  | { kind: "unknown"; request: string };

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function parseEvolutionCommand(input: string): EvolutionCommand {
  const request = input.trim();
  const normalized = normalize(request);

  if (!request) return { kind: "unknown", request };
  if (/^fix yourself$/.test(normalized)) return { kind: "fix", target: "system", request };
  if (/^upgrade jhadina$/.test(normalized)) return { kind: "upgrade", target: "system", request };
  if (/^upgrade money core$/.test(normalized)) return { kind: "upgrade", target: "money-core", request };
  if (/^apply( the fix)?$/.test(normalized)) return { kind: "apply", request };
  if (normalized.startsWith("audit this bug:")) return { kind: "audit", target: "bug", request };
  if (normalized.startsWith("fix this bug:")) return { kind: "fix", target: "bug", request };
  if (normalized.startsWith("fix money core")) return { kind: "fix", target: "money-core", request };
  if (normalized.startsWith("audit")) return { kind: "audit", target: "system", request };
  if (normalized.startsWith("fix")) return { kind: "fix", target: "system", request };
  if (normalized.startsWith("upgrade")) return { kind: "upgrade", target: "system", request };

  return { kind: "unknown", request };
}
