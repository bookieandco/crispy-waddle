import { describe, expect, it, vi } from 'vitest';
import {
  parseSrtTranscript,
  transcriptText,
  validateTranscriptLipSyncPlan,
  type TranscriptLipSyncPlan,
} from './transcript-assisted-lip-sync';
import { createVoiceSyncProvider } from './studio-voice-sync';
import { createDirectorStudioAction } from './studio-governed-action';

const timedPlan: TranscriptLipSyncPlan = {
  id: 'transcript:1',
  projectId: 'project-1',
  audioAssetId: 'audio-1',
  mode: 'timed-cues',
  audioDurationMs: 5_000,
  cues: [
    { id: '1', startMs: 0, endMs: 1_700, text: 'Make a little' },
    { id: '2', startMs: 1_700, endMs: 3_200, text: 'birdhouse in your soul' },
  ],
  language: 'en',
  evidenceIds: ['transcription:approved'],
  authority: 'DIRECTOR_TRANSCRIPT_LIP_SYNC_PLAN',
};

const syncTrack = { startMs: 0, endMs: 300, phoneme: 'M', viseme: 'M', confidence: .95 };

describe('transcript-assisted lip sync', () => {
  it('parses SRT timing into canonical transcript cues', () => {
    const cues = parseSrtTranscript(
      '1\n00:00:00,000 --> 00:00:01,250\nMake a little\n\n2\n00:00:01,250 --> 00:00:02,500\nbirdhouse in your soul',
    );
    expect(cues).toEqual([
      { id: '1', startMs: 0, endMs: 1_250, text: 'Make a little' },
      { id: '2', startMs: 1_250, endMs: 2_500, text: 'birdhouse in your soul' },
    ]);
  });

  it('prefers timed transcript evidence without hard-coding provider limits into Director', () => {
    expect(validateTranscriptLipSyncPlan(timedPlan).valid).toBe(true);
    expect(transcriptText(timedPlan)).toBe('Make a little birdhouse in your soul');

    const longUntimed: TranscriptLipSyncPlan = {
      ...timedPlan,
      id: 'transcript:untimed',
      mode: 'untimed-text',
      audioDurationMs: 200_000,
      text: 'A long performance transcript',
      cues: undefined,
    };
    expect(validateTranscriptLipSyncPlan(longUntimed).valid).toBe(true);
    expect(validateTranscriptLipSyncPlan(longUntimed, { maxUntimedDurationMs: 160_000 }).reasons)
      .toContain('DIRECTOR_TRANSCRIPT_UNTIMED_DURATION_EXCEEDED');
  });

  it('fails closed when timed cues overlap or exceed the governed audio duration', () => {
    const invalid: TranscriptLipSyncPlan = {
      ...timedPlan,
      cues: [
        { id: '1', startMs: 0, endMs: 3_000, text: 'first' },
        { id: '2', startMs: 2_900, endMs: 5_100, text: 'second' },
      ],
    };
    expect(validateTranscriptLipSyncPlan(invalid).reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_TRANSCRIPT_CUE_OVERLAP:2',
      'DIRECTOR_TRANSCRIPT_CUE_OUTSIDE_AUDIO:2',
    ]));
  });

  it('carries transcript authority through the existing governed voice-sync provider', async () => {
    const synchronize = vi.fn(async () => ({
      artifactId: 'sync-1',
      videoAssetId: 'video-1',
      audioAssetId: 'audio-1',
      provider: 'transcript-aware-sync',
      syncEvidenceIds: ['alignment:transcript'],
      averageConfidence: .94,
    }));
    const provider = createVoiceSyncProvider({ name: 'transcript-aware-sync', synchronize });
    const request = createDirectorStudioAction({
      id: 'voice-sync:1',
      userId: 'user-1',
      requestedAt: 'now',
      projectId: 'project-1',
      capability: 'voice-sync',
      inputAssetIds: ['video-1', 'audio-1'],
      parameters: { mode: 'viseme-driven', tracks: [syncTrack], transcriptPlan: timedPlan },
    });

    const result = await provider.execute(request.action, request);
    expect(synchronize).toHaveBeenCalledWith(expect.objectContaining({ transcriptPlan: timedPlan }));
    expect(result.evidenceIds).toEqual(expect.arrayContaining([
      'transcript-plan:transcript:1',
      'transcript-mode:timed-cues',
      'transcription:approved',
    ]));
  });
});
