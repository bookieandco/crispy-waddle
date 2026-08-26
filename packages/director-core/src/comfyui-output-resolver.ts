import type { ProviderOutput } from './generated-asset-resolver';

export type ComfyUIHistoryOutput = {
  filename?: string;
  subfolder?: string;
  type?: string;
};

export type ComfyUIHistoryEntry = {
  outputs?: Record<string, { images?: ComfyUIHistoryOutput[]; gifs?: ComfyUIHistoryOutput[]; audio?: ComfyUIHistoryOutput[] } | undefined>;
};

export interface ComfyUIOutputResolverOptions {
  baseUrl: string;
  outputPath?: (output: ComfyUIHistoryOutput) => string;
}

const defaultOutputPath = (output: ComfyUIHistoryOutput): string => {
  const params = new URLSearchParams();
  if (output.filename) params.set('filename', output.filename);
  if (output.subfolder) params.set('subfolder', output.subfolder);
  if (output.type) params.set('type', output.type);
  return `/view?${params.toString()}`;
};

export function resolveComfyUIHistoryOutputs(
  history: ComfyUIHistoryEntry,
  options: ComfyUIOutputResolverOptions,
): ProviderOutput[] {
  const results: ProviderOutput[] = [];
  const outputPath = options.outputPath ?? defaultOutputPath;

  for (const node of Object.values(history.outputs ?? {})) {
    for (const output of node?.images ?? []) {
      results.push({ uri: new URL(outputPath(output), options.baseUrl).toString(), mediaType: 'image' });
    }
    for (const output of node?.gifs ?? []) {
      results.push({ uri: new URL(outputPath(output), options.baseUrl).toString(), mediaType: 'video' });
    }
    for (const output of node?.audio ?? []) {
      results.push({ uri: new URL(outputPath(output), options.baseUrl).toString(), mediaType: 'audio' });
    }
  }

  return results;
}
