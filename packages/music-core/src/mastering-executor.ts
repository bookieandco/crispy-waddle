import type { MasteringPlan, MasteringStep } from "./mastering";
import { applyGain, applyPeakingEq, type DspResult } from "./restoration-dsp";
import type { RestorationMetrics, RestorationVersion } from "./restoration";

export interface AudioArtifact {
  id: string;
  samples: Float32Array<ArrayBufferLike>;
  sampleRateHz: number;
  channels: number;
}

export interface ArtifactWriter {
  write(input: { parentArtifactId: string; samples: Float32Array<ArrayBufferLike>; sampleRateHz: number; channels: number; operation: string }): AudioArtifact;
}

export interface MasteringExecutionPolicy {
  approved: boolean;
  allowOperations?: MasteringStep["operation"][];
  maxGainDb: number;
  maxTruePeakDbtp: number;
}

export interface MasteringExecutionRequest {
  plan: MasteringPlan;
  sourceVersion: RestorationVersion;
  source: AudioArtifact;
  policy: MasteringExecutionPolicy;
  now?: string;
}

export interface MasteringExecutionResult {
  artifact: AudioArtifact;
  parentVersionId: string;
  metricsBefore: RestorationMetrics;
  metricsAfter: RestorationMetrics;
  executedSteps: MasteringExecutionRecord[];
  status: "candidate" | "rejected";
  warnings: string[];
}

export interface MasteringExecutionRecord {
  stepId: string;
  operation: MasteringStep["operation"];
  parameters: MasteringStep["parameters"];
  peakBefore: number;
  peakAfter: number;
}

export class InMemoryArtifactWriter implements ArtifactWriter {
  private counter = 0;

  write(input: { parentArtifactId: string; samples: Float32Array<ArrayBufferLike>; sampleRateHz: number; channels: number; operation: string }): AudioArtifact {
    this.counter += 1;
    return {
      id: `${input.parentArtifactId}:${input.operation}:${this.counter}`,
      samples: new Float32Array(input.samples),
      sampleRateHz: input.sampleRateHz,
      channels: input.channels,
    };
  }
}

export function executeMasteringPlan(
  request: MasteringExecutionRequest,
  writer: ArtifactWriter = new InMemoryArtifactWriter(),
): MasteringExecutionResult {
  if (!request.policy.approved) {
    throw new Error("Mastering execution requires explicit policy approval");
  }
  if (request.sourceVersion.id !== request.plan.sourceVersionId) {
    throw new Error("Mastering plan does not target the supplied restoration version");
  }

  const allowed = new Set(request.policy.allowOperations ?? ["eq", "multiband", "saturation", "stereo", "limiter"]);
  let samples = new Float32Array(request.source.samples);
  const executedSteps: MasteringExecutionRecord[] = [];
  const warnings: string[] = [];
  const initialPeak = peak(samples);
  const metricsBefore: RestorationMetrics = { samplePeakDbfs: dbfs(initialPeak) };

  for (const step of [...request.plan.steps].sort((a, b) => a.priority - b.priority)) {
    if (!allowed.has(step.operation)) {
      warnings.push(`Skipped disallowed operation ${step.operation}`);
      continue;
    }

    if (step.operation === "eq") {
      const frequencyHz = numberParam(step, "frequencyHz");
      const gainDb = numberParam(step, "gainDb");
      const q = numberParam(step, "q");
      if (frequencyHz !== undefined && gainDb !== undefined && q !== undefined) {
        const result = applyPeakingEq(samples, request.source.channels, {
          sampleRateHz: request.source.sampleRateHz,
          frequencyHz,
          gainDb,
          q,
        });
        samples = new Float32Array(result.samples);
        executedSteps.push(record(step, result));
      } else if (gainDb !== undefined) {
        if (Math.abs(gainDb) > request.policy.maxGainDb) throw new Error(`Gain exceeds policy maximum: ${gainDb} dB`);
        const result = applyGain(samples, gainDb);
        samples = new Float32Array(result.samples);
        executedSteps.push(record(step, result));
      }
    } else if (step.operation === "limiter") {
      const ceilingDbtp = numberParam(step, "ceilingDbtp") ?? request.policy.maxTruePeakDbtp;
      const currentPeak = dbfs(peak(samples));
      if (currentPeak > ceilingDbtp) {
        const result = applyGain(samples, ceilingDbtp - currentPeak);
        samples = new Float32Array(result.samples);
        executedSteps.push(record(step, result));
      } else {
        executedSteps.push({ ...record(step, { samples, peakBefore: peak(samples), peakAfter: peak(samples), gainReductionDb: 0 }), peakBefore: peak(samples), peakAfter: peak(samples) });
      }
    } else {
      warnings.push(`DSP adapter not yet implemented for ${step.operation}`);
    }
  }

  const finalPeak = peak(samples);
  const finalPeakDb = dbfs(finalPeak);
  if (finalPeakDb > request.policy.maxTruePeakDbtp + 0.001) {
    return {
      artifact: request.source,
      parentVersionId: request.sourceVersion.id,
      metricsBefore,
      metricsAfter: { samplePeakDbfs: finalPeakDb },
      executedSteps,
      status: "rejected",
      warnings: [...warnings, "Post-execution peak exceeds the policy ceiling"],
    };
  }

  const artifact = writer.write({
    parentArtifactId: request.source.id,
    samples,
    sampleRateHz: request.source.sampleRateHz,
    channels: request.source.channels,
    operation: "mastering",
  });

  return {
    artifact,
    parentVersionId: request.sourceVersion.id,
    metricsBefore,
    metricsAfter: { samplePeakDbfs: finalPeakDb },
    executedSteps,
    status: "candidate",
    warnings,
  };
}

function record(step: MasteringStep, result: DspResult): MasteringExecutionRecord {
  return {
    stepId: step.id,
    operation: step.operation,
    parameters: step.parameters,
    peakBefore: result.peakBefore,
    peakAfter: result.peakAfter,
  };
}

function numberParam(step: MasteringStep, key: string): number | undefined {
  const value = step.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function peak(samples: Float32Array<ArrayBufferLike>): number {
  let value = 0;
  for (const sample of samples) value = Math.max(value, Math.abs(Number.isFinite(sample) ? sample : 0));
  return value;
}

function dbfs(value: number): number {
  return value <= 0 ? -Infinity : 20 * Math.log10(value);
}
