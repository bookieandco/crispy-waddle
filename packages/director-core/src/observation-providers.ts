import type { Observation } from './observation-bus.js';

export type ObservationProvider<TInput = unknown> = {
  name: string;
  analyze(input: TInput): Promise<Observation[]>;
};

export type TimedVisionInput = { assetId: string; observations: Array<{ id: string; startSeconds: number; endSeconds: number; label: string; confidence?: number; metadata?: Record<string, unknown> }> };
export type TimedTranscriptInput = { assetId: string; segments: Array<{ id: string; startSeconds: number; endSeconds: number; text: string; confidence?: number; speaker?: string }> };
export type TimedAudioInput = { assetId: string; events: Array<{ id: string; startSeconds: number; endSeconds: number; kind: string; label?: string; confidence?: number; metadata?: Record<string, unknown> }> };

export function createCvatAdapter(): ObservationProvider<TimedVisionInput> {
  return { name: 'cvat', async analyze(input) { return input.observations.map(item => ({ id: item.id, assetId: input.assetId, source: 'cvat', modality: 'vision', kind: 'annotation', time: { startSeconds: item.startSeconds, endSeconds: item.endSeconds }, label: item.label, confidence: item.confidence, metadata: item.metadata })); } };
}

export function createHumanAdapter(): ObservationProvider<TimedVisionInput> {
  return { name: 'human', async analyze(input) { return input.observations.map(item => ({ id: item.id, assetId: input.assetId, source: 'human', modality: 'vision', kind: 'detection', time: { startSeconds: item.startSeconds, endSeconds: item.endSeconds }, label: item.label, confidence: item.confidence, metadata: item.metadata })); } };
}

export function createWhisperAdapter(): ObservationProvider<TimedTranscriptInput> {
  return { name: 'whisper', async analyze(input) { return input.segments.map(item => ({ id: item.id, assetId: input.assetId, source: 'whisper', modality: 'transcript', kind: 'speech', time: { startSeconds: item.startSeconds, endSeconds: item.endSeconds }, text: item.text, confidence: item.confidence, metadata: item.speaker ? { speaker: item.speaker } : undefined })); } };
}

export function createSenseVoiceAdapter(): ObservationProvider<TimedTranscriptInput> {
  return { name: 'sensevoice', async analyze(input) { return input.segments.map(item => ({ id: item.id, assetId: input.assetId, source: 'sensevoice', modality: 'transcript', kind: 'speech', time: { startSeconds: item.startSeconds, endSeconds: item.endSeconds }, text: item.text, confidence: item.confidence, metadata: item.speaker ? { speaker: item.speaker } : undefined })); } };
}

export function createEssentiaAdapter(): ObservationProvider<TimedAudioInput> {
  return { name: 'essentia', async analyze(input) { return input.events.map(item => ({ id: item.id, assetId: input.assetId, source: 'essentia', modality: 'audio', kind: item.kind, time: { startSeconds: item.startSeconds, endSeconds: item.endSeconds }, label: item.label, confidence: item.confidence, metadata: item.metadata })); } };
}

export type ProviderRegistry = ReturnType<typeof createObservationProviderRegistry>;
export function createObservationProviderRegistry(providers: ObservationProvider[] = []) {
  const registry = new Map<string, ObservationProvider>();
  for (const provider of providers) registry.set(provider.name, provider);
  return {
    register(provider: ObservationProvider) { registry.set(provider.name, provider); },
    get(name: string) { return registry.get(name); },
    list() { return [...registry.values()]; },
  };
}
