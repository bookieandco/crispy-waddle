import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import type { GenerationProviderRecord } from './generation-registry';

export type SrtCounterParameters = {
  start?: number;
  end?: number;
  durationMs?: number;
  prefix?: string;
};

function encodeDataUri(content: string): string {
  return `data:text/plain;base64,${Buffer.from(content, 'utf8').toString('base64')}`;
}

function formatTimestamp(milliseconds: number): string {
  const totalMs = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const ms = totalMs % 1_000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function renderSrtCounter(parameters: SrtCounterParameters = {}): string {
  const start = Number.isFinite(parameters.start) ? Math.trunc(parameters.start!) : 0;
  const end = Number.isFinite(parameters.end) ? Math.trunc(parameters.end!) : 600;
  const durationMs = Number.isFinite(parameters.durationMs) ? Math.max(1, Math.trunc(parameters.durationMs!)) : 100;
  const prefix = parameters.prefix ?? '$';
  if (end < start) throw new Error('SRT counter end must be greater than or equal to start');

  return Array.from({ length: end - start + 1 }, (_, index) => {
    const from = index * durationMs;
    const to = from + durationMs;
    return `${index + 1}\n${formatTimestamp(from)} --> ${formatTimestamp(to)}\n${prefix}${start + index}\n`;
  }).join('\n');
}

export class SrtCounterProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderRecord;

  constructor(descriptor: GenerationProviderRecord) {
    if (!descriptor.capabilities.includes('text-to-subtitle')) {
      throw new Error('SrtCounterProvider requires text-to-subtitle capability');
    }
    this.descriptor = descriptor;
  }

  async submit(request: GenerationRequest): Promise<GenerationResult> {
    const content = renderSrtCounter(request.parameters as SrtCounterParameters);
    const uri = encodeDataUri(content);
    return {
      requestId: request.requestId,
      providerId: this.descriptor.id,
      status: 'completed',
      assetIds: [`${request.requestId}:asset:1`],
      providerJobId: request.requestId,
      metadata: {
        outputs: [{ uri, mediaType: 'subtitle', mimeType: 'application/x-subrip' }],
        operation: 'srt-counter',
      },
    };
  }

  async status(providerJobId: string): Promise<GenerationResult> {
    throw new Error(`SRT counter jobs are synchronous: ${providerJobId}`);
  }

  async cancel(): Promise<void> {}
}
