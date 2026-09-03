export type PluginFormat = "vst3" | "vst2" | "clap" | "lv2";

export interface PluginParameterDescriptor {
  id: string;
  name: string;
  unit?: string;
  stepCount: number;
  defaultNormalizedValue: number;
  automatable: boolean;
  min?: number;
  max?: number;
}

export interface PluginDescriptor {
  id: string;
  vendor: string;
  name: string;
  version: string;
  format: PluginFormat;
  binaryHash: string;
  parameters: PluginParameterDescriptor[];
}

export interface AutomationPoint {
  sampleOffset: number;
  normalizedValue: number;
}

export interface PluginAutomationTrack {
  parameterId: string;
  points: AutomationPoint[];
}

export interface PluginAutomationPlan {
  id: string;
  pluginId: string;
  pluginBinaryHash: string;
  sourceArtifactId: string;
  tracks: PluginAutomationTrack[];
  allowedParameterIds: string[];
  protectedRegions: Array<{ startSample: number; endSample: number }>;
  maxParameterDelta: Record<string, number>;
  evidenceIds: string[];
}

export interface PluginAutomationValidation {
  allowed: boolean;
  reasons: string[];
}

const unique = (values: string[]): string[] => [...new Set(values)];

function inRegion(sample: number, region: { startSample: number; endSample: number }): boolean {
  return sample >= region.startSample && sample < region.endSample;
}

export function sortAutomationPoints(points: AutomationPoint[]): AutomationPoint[] {
  return [...points].sort((a, b) => a.sampleOffset - b.sampleOffset);
}

/** Validates automation without executing a plugin. */
export function validatePluginAutomationPlan(
  plugin: PluginDescriptor,
  plan: PluginAutomationPlan,
): PluginAutomationValidation {
  const reasons: string[] = [];
  if (plan.pluginId !== plugin.id) reasons.push("Automation plan plugin does not match descriptor.");
  if (plan.pluginBinaryHash !== plugin.binaryHash) reasons.push("Plugin binary hash does not match the authorized descriptor.");
  if (!plan.sourceArtifactId) reasons.push("Source artifact is required.");

  const parameterMap = new Map(plugin.parameters.map((parameter) => [parameter.id, parameter]));
  const allowed = new Set(plan.allowedParameterIds);

  for (const track of plan.tracks) {
    const parameter = parameterMap.get(track.parameterId);
    if (!parameter) {
      reasons.push(`Unknown plugin parameter: ${track.parameterId}`);
      continue;
    }
    if (!parameter.automatable) reasons.push(`Parameter is not automatable: ${track.parameterId}`);
    if (!allowed.has(track.parameterId)) reasons.push(`Parameter is outside the automation policy: ${track.parameterId}`);

    if (track.points.length > 1) {
      for (let i = 1; i < track.points.length; i += 1) {
        if (track.points[i].sampleOffset <= track.points[i - 1].sampleOffset) {
          reasons.push(`Automation points must have strictly increasing sample offsets: ${track.parameterId}`);
        }
      }
    }

    const ordered = sortAutomationPoints(track.points);
    let previous = parameter.defaultNormalizedValue;
    for (const point of ordered) {
      const validOffset = Number.isInteger(point.sampleOffset) && point.sampleOffset >= 0;
      const validValue = Number.isFinite(point.normalizedValue) && point.normalizedValue >= 0 && point.normalizedValue <= 1;
      if (!validOffset) reasons.push(`Invalid sample offset: ${track.parameterId}`);
      if (!validValue) reasons.push(`Normalized parameter value must be within [0,1]: ${track.parameterId}`);
      if (validOffset && validValue) {
        const maxDelta = plan.maxParameterDelta[track.parameterId];
        if (maxDelta !== undefined && (!Number.isFinite(maxDelta) || maxDelta < 0 || Math.abs(point.normalizedValue - previous) > maxDelta)) {
          reasons.push(`Parameter delta exceeds policy: ${track.parameterId}`);
        }
        if (plan.protectedRegions.some((region) => inRegion(point.sampleOffset, region))) {
          reasons.push(`Automation enters a protected region: ${track.parameterId}`);
        }
        previous = point.normalizedValue;
      }
    }
  }

  for (const parameterId of plan.allowedParameterIds) {
    if (!parameterMap.has(parameterId)) reasons.push(`Policy references unknown parameter: ${parameterId}`);
  }

  return { allowed: reasons.length === 0, reasons: unique(reasons) };
}
