import { describe, expect, it } from 'vitest';
import {
  SupabaseStoryboardRepository,
  type SupabaseStoryboardClient,
} from './storyboard-persistence.js';

describe('SupabaseStoryboardRepository structured direction persistence', () => {
  it('selects and hydrates camera, performance, realism, and animation plans', async () => {
    let selectedColumns = '';
    const row = {
      id: 'board:1',
      sequence_id: 'sequence:1',
      project_id: 'project:1',
      shot_id: 'shot:1',
      ordinal: 0,
      status: 'approved',
      title: 'Reaction',
      description: null,
      script_ref: null,
      reference_asset_ids: ['ref:actor'],
      continuity_anchor_ids: [],
      continuity_locks: ['character', 'camera'],
      camera_language: 'slow push-in',
      framing: 'close-up',
      action: 'she realizes the truth',
      notes: null,
      cinematography: null,
      camera_plan: {
        version: 1,
        target: 'virtual-camera',
        intent: { narrativeFunction: 'compress the realization' },
        composition: { shotSize: 'close-up', angle: 'eye-level' },
        optics: { focalLengthMm: 85 },
        movements: [{
          kind: 'dolly-in',
          intensity: 'subtle',
          motivation: 'tighten emotional pressure',
        }],
        timing: { durationSeconds: 2 },
      },
      performance_plan: {
        version: 1,
        sceneFunction: 'realization lands without melodrama',
        actors: [{
          actorId: 'actor:maya',
          startState: 'guarded',
          endState: 'quietly shaken',
        }],
        beats: [{
          id: 'beat:1',
          order: 1,
          kind: 'reaction',
          actorId: 'actor:maya',
          direction: 'eyes settle before the breath catches',
        }],
        preservationRules: ['keep body movement restrained'],
      },
      realism_plan: {
        version: 1,
        goal: 'natural human reaction with plausible micro-motion',
        naturalismCues: ['small breath change', 'asymmetric blink timing'],
        physicalChains: [],
        preservation: [],
      },
      animation_plan: {
        version: 1,
        narrativeGoal: 'make the reaction readable before motion resumes',
        primaryAction: 'head turns toward the sound',
        method: 'pose-to-pose',
        poseHierarchy: { keys: ['neutral', 'anticipation glance', 'turned reaction'] },
        staging: {
          primaryRead: 'the head turn',
          audienceAttentionTarget: 'eyes and face',
          competingActionPolicy: 'none',
        },
        timing: { fps: 24, exposure: 'twos', primaryActionFrames: 12 },
      },
      version: 4,
      artifact_ids: ['artifact:board'],
      updated_at: '2026-09-22T23:20:00.000Z',
    };

    const query: any = {
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    const client: SupabaseStoryboardClient = {
      from: () => ({
        select: (columns: string) => {
          selectedColumns = columns;
          return query;
        },
      }),
    };

    const repository = new SupabaseStoryboardRepository(client);
    const board = await repository.getBoard('board:1', 'project:1');

    expect(selectedColumns).toContain('camera_plan');
    expect(selectedColumns).toContain('performance_plan');
    expect(selectedColumns).toContain('realism_plan');
    expect(selectedColumns).toContain('animation_plan');
    expect(board?.cameraPlan).toEqual(row.camera_plan);
    expect(board?.performancePlan).toEqual(row.performance_plan);
    expect(board?.realismPlan).toEqual(row.realism_plan);
    expect(board?.animationPlan).toEqual(row.animation_plan);
  });
});
