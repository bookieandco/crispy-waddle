import { describe, expect, it } from 'vitest';
import {
  characterRuntimeComputeDraft,
  jllmInteractiveComputeDraft,
  jllmVoiceComputeDraft,
  memoryMaintenanceComputeDraft,
} from './runtime-workloads';

describe('JLLM and memory compute workload adapters', () => {
  it('binds JLLM inference to the durable work session and keeps it private', () => {
    const draft = jllmInteractiveComputeDraft({
      requestId: 'request-1',
      workSessionId: 'session-1',
      profileId: 'jllm.interactive.default',
      modelId: 'jllm-local',
      memoryIds: ['m1'],
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.authority).toEqual({
      system: 'jhadina-work-session',
      jobId: 'session-1',
      idempotencyKey: 'request-1',
    });
    expect(draft.kind).toBe('llm-interactive');
    expect(draft.constraints).toEqual({ sensitiveData: true });
    expect(draft.dataLocalityKeys).toContain('memory:m1');
  });

  it('puts live voice in the interactive queue', () => {
    const draft = jllmVoiceComputeDraft({
      requestId: 'voice-request-1',
      workSessionId: 'session-1',
      voiceIdentityId: 'jhadina-voice',
      profileId: 'jllm.voice.realtime',
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.kind).toBe('voice-generation');
    expect(draft.queue).toBe('interactive');
    expect(draft.dataLocalityKeys).toContain('voice:jhadina-voice');
  });

  it('keeps persistent character runtime tied to caller-supplied durable authority', () => {
    const draft = characterRuntimeComputeDraft({
      runtimeId: 'mike-runtime-1',
      characterId: 'mike',
      authority: {
        system: 'director-character-session',
        jobId: 'character-session-1',
        idempotencyKey: 'character-session-1',
        projectId: 'movie-1',
      },
      profileId: 'character.runtime.default',
      modelIds: ['brain-1', 'face-1'],
      voiceIdentityId: 'mike-voice',
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.kind).toBe('character-runtime');
    expect(draft.dataLocalityKeys).toEqual([
      'character:mike',
      'model:brain-1',
      'model:face-1',
      'voice:mike-voice',
    ]);
  });

  it('describes memory embedding work without gaining memory authority', () => {
    const draft = memoryMaintenanceComputeDraft({
      jobId: 'memory-job-1',
      idempotencyKey: 'memory-job-1',
      profileId: 'memory.embedding.default',
      operation: 'embedding',
      memoryIds: ['m1', 'm2'],
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.source).toBe('memory');
    expect(draft.kind).toBe('embedding');
    expect(draft.authority.system).toBe('memory-maintenance-job');
    expect(draft.constraints?.sensitiveData).toBe(true);
    expect(draft.constraints?.allowCloudBurst).toBeUndefined();
  });
});
