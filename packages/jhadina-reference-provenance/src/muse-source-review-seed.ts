import {
  type ReferenceProvenanceRegistry,
  type RegisterReferenceInput,
} from './index.js';

/**
 * Source review, NOT an endorsement, binary attestation or model/provider
 * permission. Meta Muse Spark is an actual model family; an unrelated GitHub
 * org using that name has not demonstrated official Meta publisher identity.
 */
export const MUSE_SOURCE_REVIEW_REFERENCES: readonly RegisterReferenceInput[] = [
  {
    referenceId: 'github:muse-spark-app/muse-spark',
    canonicalName: 'muse-spark-app/muse-spark community repository (unverified publisher)',
    kind: 'GITHUB_REPOSITORY',
    roles: ['INSPIRATION', 'SECURITY_REFERENCE'],
    canonicalLocator: 'https://github.com/muse-spark-app/muse-spark',
    discoveredFrom: 'USER',
    traceabilityStatus: 'REJECTED',
    licenseStatus: 'DECLARED_UNVERIFIED',
    licenseExpression: 'MIT',
    notes:
      'Rejected as executable or official Meta reference. README claims official affiliation and production-grade local inference, RAG, TTS and encrypted workspace, while reviewed Python modules are mock/placeholder implementations. Release binary was NOT downloaded, executed, independently audited or vendor-attested. Preserve IDEA_ONLY analysis, never run its installer or treat its brand claim as authority.',
    evidence: [
      { evidenceId: 'muse-source-readme', kind: 'URL', locator: 'https://github.com/muse-spark-app/muse-spark/blob/main/README.md' },
      { evidenceId: 'muse-source-llm', kind: 'URL', locator: 'https://github.com/muse-spark-app/muse-spark/blob/main/core/llm_engine.py' },
      { evidenceId: 'muse-source-rag', kind: 'URL', locator: 'https://github.com/muse-spark-app/muse-spark/blob/main/core/rag_manager.py' },
      { evidenceId: 'muse-source-voice', kind: 'URL', locator: 'https://github.com/muse-spark-app/muse-spark/blob/main/core/voice_studio.py' },
      { evidenceId: 'muse-source-releases', kind: 'URL', locator: 'https://github.com/muse-spark-app/muse-spark/releases' },
    ],
  },
  {
    referenceId: 'website:meta-official-muse-spark-api',
    canonicalName: 'Official Meta Model API / Muse Spark information',
    kind: 'API_DOCUMENTATION',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'https://dev.meta.ai/',
    discoveredFrom: 'WEB_RESEARCH',
    traceabilityStatus: 'EXTERNALLY_VERIFIED',
    licenseStatus: 'UNKNOWN',
    notes:
      'Official product/documentation reference only. API commercial terms, provider authorization, cost, privacy and live model performance must be independently admitted. No credentials or calls from this seed.',
    evidence: [
      { evidenceId: 'muse-official-model-info', kind: 'URL', locator: 'https://research.meta.ai/blog/introducing-muse-spark-1-3' },
      { evidenceId: 'muse-official-model-api', kind: 'URL', locator: 'https://dev.meta.ai/' },
    ],
  },
];

export function registerMuseSourceReviewReferences(registry: ReferenceProvenanceRegistry): void {
  for (const input of MUSE_SOURCE_REVIEW_REFERENCES) registry.registerReference(input);
}
