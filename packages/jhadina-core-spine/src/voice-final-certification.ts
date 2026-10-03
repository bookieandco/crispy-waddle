import {
  JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE,
  JHADINA_CANONICAL_VOICE_IDENTITY_ID,
} from './jhadina-voice-identity.js';
import type {JhadinaVoiceSurface} from './voice-surface-binding.js';

export type JhadinaVoiceFinalStatus =
  | 'blocked'
  | 'source-certified'
  | 'production-certified';

export type JhadinaVoiceFinalCheckId =
  | 'source-namesake-corpus'
  | 'source-personality-behavior'
  | 'source-quip-engine'
  | 'source-banter-engine'
  | 'source-callback-learning'
  | 'source-prosody-genome'
  | 'source-surface-unification'
  | 'source-serious-firewalls'
  | 'source-exact-head-tests'
  | 'live-approved-identity'
  | 'live-reference-hash'
  | 'live-fingerprint'
  | 'live-approval-receipt'
  | 'live-provider-redundancy'
  | 'live-speaker-qc'
  | 'live-accepted-take'
  | 'live-forced-drift'
  | 'live-streaming-latency'
  | 'live-barge-in'
  | 'live-disconnect-cancellation'
  | 'live-cross-surface';

export interface JhadinaVoiceSourceEvidence {
  sourceHeadSha:string;
  namesakeCorpus:boolean;
  personalityBehaviorPipeline:boolean;
  quipEngine:boolean;
  banterBitEngine:boolean;
  callbackLearning:boolean;
  prosodyGenome:boolean;
  surfaceUnification:boolean;
  seriousModeFirewalls:boolean;
  exactHeadTests:{
    passed:boolean;
    headSha:string;
    receiptId:string;
  };
}

export interface JhadinaVoiceProviderReceipt {
  providerId:string;
  ready:boolean;
  modelId:string;
  providerVoiceRef:string;
  receiptId:string;
}

export interface JhadinaVoiceSpeakerQcReceipt {
  modelId:string;
  modelRevision:string;
  minimumSimilarity:number;
  acceptedTakeReceiptId:string;
  forcedDriftReceiptId:string;
}

export interface JhadinaVoiceStreamingReceipt {
  fastLaneLatencyReceiptId:string;
  normalLatencyReceiptId:string;
  bargeInReceiptId:string;
  disconnectCancellationReceiptId:string;
}

export interface JhadinaVoiceSurfaceReceipt {
  surface:JhadinaVoiceSurface;
  receiptId:string;
  speakerIdentityRef:string;
}

export interface JhadinaVoiceLiveEvidence {
  voiceIdentityId:string;
  identityStatus:'candidate'|'approved'|'retired';
  referenceSha256:string;
  speakerFingerprintReceiptId:string;
  approvalReceiptId:string;
  providers:readonly JhadinaVoiceProviderReceipt[];
  speakerQc:JhadinaVoiceSpeakerQcReceipt;
  streaming:JhadinaVoiceStreamingReceipt;
  surfaceReceipts:readonly JhadinaVoiceSurfaceReceipt[];
}

export interface JhadinaVoiceFinalEvidence {
  source:JhadinaVoiceSourceEvidence;
  live?:Partial<JhadinaVoiceLiveEvidence>;
}

export interface JhadinaVoiceFinalCheck {
  id:JhadinaVoiceFinalCheckId;
  passed:boolean;
  reason:string;
  layer:'source'|'live';
}

export interface JhadinaVoiceFinalDecision {
  status:JhadinaVoiceFinalStatus;
  sourceCertified:boolean;
  productionCertified:boolean;
  checks:readonly JhadinaVoiceFinalCheck[];
  reasons:readonly string[];
  authority:'JHADINA_VOICE_FINAL_CERTIFICATION';
}

const HEX_40=/^[a-f0-9]{40}$/i;
const HEX_64=/^[a-f0-9]{64}$/i;
const REQUIRED_LIVE_SURFACES:readonly JhadinaVoiceSurface[]=Object.freeze(['ask','director']);

function clean(value:unknown):boolean{
  return typeof value==='string'&&value.trim().length>0;
}

function check(
  id:JhadinaVoiceFinalCheckId,
  passed:boolean,
  reason:string,
  layer:'source'|'live',
):JhadinaVoiceFinalCheck{
  return Object.freeze({id,passed,reason,layer});
}

/**
 * Fail-closed final evaluator for Jhadina's canonical voice.
 *
 * Source certification proves the architecture/runtime contracts are present
 * on the exact tested head. Production certification additionally requires
 * real external acoustic receipts. Missing live evidence never gets inferred
 * from source readiness.
 */
export function evaluateJhadinaVoiceFinalCertification(
  evidence:JhadinaVoiceFinalEvidence,
):JhadinaVoiceFinalDecision{
  const source=evidence.source;
  const live=evidence.live;

  const sourceChecks:JhadinaVoiceFinalCheck[]=[
    check('source-namesake-corpus',source.namesakeCorpus,'Namesake/reference corpus is source-certified.','source'),
    check('source-personality-behavior',source.personalityBehaviorPipeline,'Personality → Real Nigga Core → Behavior → Expression path is source-certified.','source'),
    check('source-quip-engine',source.quipEngine,'Governed quip engine is source-certified.','source'),
    check('source-banter-engine',source.banterBitEngine,'Ephemeral banter-bit lifecycle is source-certified.','source'),
    check('source-callback-learning',source.callbackLearning,'Callback learning/provenance/revocation is source-certified.','source'),
    check('source-prosody-genome',source.prosodyGenome,'Expression prosody genome transport is source-certified.','source'),
    check('source-surface-unification',source.surfaceUnification,'Canonical speaker identity is unified across source surfaces.','source'),
    check('source-serious-firewalls',source.seriousModeFirewalls,'Serious/high-stakes expression firewalls are source-certified.','source'),
    check(
      'source-exact-head-tests',
      source.exactHeadTests.passed &&
        HEX_40.test(source.sourceHeadSha) &&
        source.exactHeadTests.headSha===source.sourceHeadSha &&
        clean(source.exactHeadTests.receiptId),
      'Exact-head automated certification must pass on the declared source SHA with a receipt.',
      'source',
    ),
  ];

  const identityApproved=Boolean(
    live &&
    live.voiceIdentityId===JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
    live.identityStatus==='approved',
  );
  const providerReceipts=(live?.providers ?? []).filter((provider)=>
    provider.ready &&
    clean(provider.providerId) &&
    clean(provider.modelId) &&
    clean(provider.providerVoiceRef) &&
    clean(provider.receiptId)
  );
  const distinctProviders=new Set(providerReceipts.map((provider)=>provider.providerId));
  const qc=live?.speakerQc;
  const streaming=live?.streaming;
  const surfaceReceipts=live?.surfaceReceipts ?? [];

  const crossSurfacePassed=REQUIRED_LIVE_SURFACES.every((surface)=>
    surfaceReceipts.some((receipt)=>
      receipt.surface===surface &&
      receipt.speakerIdentityRef===JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
      clean(receipt.receiptId)
    )
  );

  const liveChecks:JhadinaVoiceFinalCheck[]=[
    check(
      'live-approved-identity',
      identityApproved,
      'Canonical Jhadina voice identity must be explicitly approved; candidate identity is not production identity.',
      'live',
    ),
    check(
      'live-reference-hash',
      Boolean(live&&HEX_64.test(live.referenceSha256??'')),
      'The exact approved acoustic reference must have a SHA-256 fingerprint.',
      'live',
    ),
    check(
      'live-fingerprint',
      Boolean(live&&clean(live.speakerFingerprintReceiptId)),
      'Provider-independent speaker fingerprint receipt is required.',
      'live',
    ),
    check(
      'live-approval-receipt',
      Boolean(live&&clean(live.approvalReceiptId)),
      'Explicit human voice-approval receipt is required.',
      'live',
    ),
    check(
      'live-provider-redundancy',
      distinctProviders.size>=2,
      'At least two independently bound, ready native TTS provider lanes are required.',
      'live',
    ),
    check(
      'live-speaker-qc',
      Boolean(
        qc &&
        clean(qc.modelId) &&
        clean(qc.modelRevision) &&
        Number.isFinite(qc.minimumSimilarity) &&
        qc.minimumSimilarity>=JHADINA_CANONICAL_VOICE_IDENTITY_CANDIDATE.minimumSpeakerSimilarity &&
        qc.minimumSimilarity<=1
      ),
      'Speaker-QC must be pinned and enforce at least the canonical minimum similarity threshold.',
      'live',
    ),
    check(
      'live-accepted-take',
      Boolean(qc&&clean(qc.acceptedTakeReceiptId)),
      'A real accepted production take receipt is required.',
      'live',
    ),
    check(
      'live-forced-drift',
      Boolean(qc&&clean(qc.forcedDriftReceiptId)),
      'A forced below-floor/drift rejection receipt is required.',
      'live',
    ),
    check(
      'live-streaming-latency',
      Boolean(
        streaming &&
        clean(streaming.fastLaneLatencyReceiptId) &&
        clean(streaming.normalLatencyReceiptId)
      ),
      'Measured fast-lane and normal first-audio latency receipts are required.',
      'live',
    ),
    check(
      'live-barge-in',
      Boolean(streaming&&clean(streaming.bargeInReceiptId)),
      'A real barge-in interruption receipt is required.',
      'live',
    ),
    check(
      'live-disconnect-cancellation',
      Boolean(streaming&&clean(streaming.disconnectCancellationReceiptId)),
      'Server disconnect/cancellation receipt is required.',
      'live',
    ),
    check(
      'live-cross-surface',
      crossSurfacePassed,
      'Current live Ask and Director surfaces must both prove the same canonical speaker identity.',
      'live',
    ),
  ];

  const checks=Object.freeze([...sourceChecks,...liveChecks]);
  const sourceCertified=sourceChecks.every((item)=>item.passed);
  const productionCertified=sourceCertified&&liveChecks.every((item)=>item.passed);
  const status:JhadinaVoiceFinalStatus=productionCertified
    ? 'production-certified'
    : sourceCertified
      ? 'source-certified'
      : 'blocked';

  return Object.freeze({
    status,
    sourceCertified,
    productionCertified,
    checks,
    reasons:Object.freeze(checks.filter((item)=>!item.passed).map((item)=>item.reason)),
    authority:'JHADINA_VOICE_FINAL_CERTIFICATION',
  });
}
