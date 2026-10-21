import { describe, expect, it } from 'vitest';
import {
  createExplainerPlan,
  directExplainerRevision,
  explainerSrt,
  proposeExplainerSocialDraft,
  type ExplainerInput,
} from './explainer-director.js';

const base: ExplainerInput = {
  id: 'ex:1',
  projectId: 'director:owner:1',
  title: 'How an airspeed sensor works',
  audience: 'curious adults',
  script: 'An airspeed sensor measures pressure while an aircraft moves. A blocked sensor can report misleading readings. Pilots must verify disagreeing indications using established procedures.',
  style: 'minimal',
  voiceDirection: 'documentary',
  pace: 'normal',
  aspectRatio: '9:16',
  captions: true,
  durationSeconds: 30,
  sourceRefs: ['research:airspeed:1'],
  rightsEvidenceRefs: ['rights:research:1'],
};

describe('JH-DIRECTOR.EXPLAIN.01–.06', () => {
  it('uses the canonical explainer scope and preserves supplied narration only', () => {
    const plan = createExplainerPlan(base);
    expect(plan.schemaVersion).toBe('director.explainer.v1');
    expect(plan.projectId).toBe(base.projectId);
    expect(plan.scenes.map(scene => scene.narration).join(' ')).toBe(base.script);
    expect(plan.scenes[0].role).toBe('hook');
    expect(plan.scenes.at(-1)?.endSeconds).toBe(30);
    expect(plan.scenes.every(scene => scene.verification === 'SOURCE_REVIEW_REQUIRED')).toBe(true);
    expect(plan.mediaAuthority).toBe('PREVIEW_ONLY');
    expect(plan.publicationAuthority).toBe('NONE');
  });

  it('enforces provenance rights and duration limits', () => {
    expect(() => createExplainerPlan({ ...base, rightsEvidenceRefs: [] })).toThrow(/RIGHTS_REQUIRED/);
    expect(() => createExplainerPlan({ ...base, durationSeconds: 0 })).toThrow(/DURATION_INVALID/);
    expect(() => createExplainerPlan({ ...base, aspectRatio: 'auto' as never })).toThrow(/PROFILE_INVALID/);
  });

  it('splits long uninterrupted script without dropping words', () => {
    const words = Array.from({ length: 70 }, (_, i) => 'word' + i).join(' ');
    const plan = createExplainerPlan({ ...base, script: words });
    expect(plan.scenes.length).toBeGreaterThan(1);
    expect(plan.scenes.map(scene => scene.narration).join(' ')).toBe(words);
    expect(plan.scenes.at(-1)?.endSeconds).toBe(30);
  });

  it('revises one scene without mutating previous revision or changing authority', () => {
    const first = createExplainerPlan(base);
    const revised = directExplainerRevision(first, 'scene 2 visual: Animated sensor dial changes');
    expect(revised.revision).toBe(first.revision + 1);
    expect(revised.scenes[1].visualDirection).toBe('Animated sensor dial changes');
    expect(first.scenes[1].visualDirection).not.toBe('Animated sensor dial changes');
    expect(revised.publicationAuthority).toBe('NONE');
    const paced = directExplainerRevision(revised, 'duration 45');
    expect(paced.scenes.at(-1)?.endSeconds).toBe(45);
  });

  it('rejects unsupported free-form commands instead of pretending to use AI', () => {
    const first = createExplainerPlan(base);
    expect(() => directExplainerRevision(first, 'make a complete cinematic movie now')).toThrow(/UNSUPPORTED/);
    expect(() => directExplainerRevision(first, 'scene 999 visual: cloud')).toThrow(/NOT_FOUND/);
    expect(() => directExplainerRevision(first, 'format sideways')).toThrow(/INVALID/);
  });

  it('exports timed captions without granting production approval', () => {
    const plan = createExplainerPlan(base);
    const srt = explainerSrt(plan);
    expect(srt).toContain('00:00:00,000 -->');
    expect(srt).toContain('An airspeed sensor');
    expect(srt).toContain('00:00:30,000');
  });

  it('does not create a social-ready draft without real approved asset, QC and rights', () => {
    const plan = createExplainerPlan(base);
    const record = {
      approvedDirectorAssetId: 'master:1',
      assetApprovalReceiptId: 'approval:1',
      finalQcEvidenceRefs: ['qc:1'],
      targetPlatform: 'youtube-shorts',
    };
    expect(() => proposeExplainerSocialDraft(plan, { ...record, assetApprovalReceiptId: '' })).toThrow(/APPROVAL_REQUIRED/);
    expect(() => proposeExplainerSocialDraft(plan, { ...record, finalQcEvidenceRefs: [] })).toThrow(/QC_REQUIRED/);
    expect(() => proposeExplainerSocialDraft(createExplainerPlan({ ...base, sourceRefs: [], rightsEvidenceRefs: [] }), record)).toThrow(/RIGHTS_REQUIRED/);
    expect(proposeExplainerSocialDraft(plan, record)).toMatchObject({
      status: 'PENDING_CANONICAL_SOCIAL_HANDOFF',
      publicationAuthority: 'NONE',
      paidMediaAuthority: 'NONE',
    });
  });
});
