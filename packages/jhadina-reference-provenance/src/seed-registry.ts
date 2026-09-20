import {
  ReferenceProvenanceRegistry,
  type RegisterReferenceInput,
  type RegisterMappingInput,
} from './index.js';

const tracedReferences: readonly RegisterReferenceInput[] = [
  {
    referenceId: 'github:godotengine/godot',
    canonicalName: 'Godot Engine',
    kind: 'GITHUB_REPOSITORY',
    roles: ['UI_REFERENCE', 'INSPIRATION'],
    canonicalLocator: 'https://github.com/godotengine/godot',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes:
      'Explicitly named as an inspiration/reference in the PupsonStuff engine plan. No code-derivation claim is made.',
    evidence: [
      {
        evidenceId: 'repo:pupsonstuff-engine-plan:godot',
        kind: 'REPO_PATH',
        locator: 'repo:apps/pupsonstuff/.pupsonstuff-engine-plan.md',
      },
    ],
  },
  {
    referenceId: 'github:turbulenz/turbulenz_engine',
    canonicalName: 'Turbulenz Engine',
    kind: 'GITHUB_REPOSITORY',
    roles: ['UI_REFERENCE', 'INSPIRATION'],
    canonicalLocator:
      'https://github.com/turbulenz/turbulenz_engine',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes:
      'Explicitly named as an inspiration/reference in the PupsonStuff engine plan. No code-derivation claim is made.',
    evidence: [
      {
        evidenceId: 'repo:pupsonstuff-engine-plan:turbulenz',
        kind: 'REPO_PATH',
        locator: 'repo:apps/pupsonstuff/.pupsonstuff-engine-plan.md',
      },
    ],
  },
  {
    referenceId: 'api:dexscreener',
    canonicalName: 'DexScreener API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://api.dexscreener.com',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes:
      'Runtime provider integration. This record describes provenance of the integration, not trust in any observation returned by the provider.',
    evidence: [
      {
        evidenceId: 'repo:dexscreener-pool-discovery',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/pool-discovery.ts',
      },
      {
        evidenceId: 'repo:dexscreener-event-ingest',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/dexscreener-event-ingest.ts',
      },
    ],
  },
];

const handoffOnlyReferences: readonly RegisterReferenceInput[] = [
  {
    referenceId: 'github:maariia-saez/MDP-Adaptive-GA',
    canonicalName: 'MDP-Adaptive-GA',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE'],
    canonicalLocator:
      'https://github.com/maariia-saez/MDP-Adaptive-GA',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in sports handoff history; not traceable on current crispy-waddle main at REF-PROV-01 audit time.',
    evidence: [
      {
        evidenceId: 'handoff:sports:mdp-adaptive-ga',
        kind: 'HANDOFF_NOTE',
        locator: 'urn:jhadina:handoff:sports:mdp-adaptive-ga',
      },
    ],
  },
  {
    referenceId: 'github:yinzhangyue/SelfAware',
    canonicalName: 'SelfAware',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'https://github.com/yinzhangyue/SelfAware',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in sports handoff history; not traceable on current crispy-waddle main at REF-PROV-01 audit time.',
    evidence: [
      {
        evidenceId: 'handoff:sports:selfaware',
        kind: 'HANDOFF_NOTE',
        locator: 'urn:jhadina:handoff:sports:selfaware',
      },
    ],
  },
  {
    referenceId: 'github:RC-Dynamics/Coach-RL',
    canonicalName: 'Coach-RL',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE'],
    canonicalLocator:
      'https://github.com/RC-Dynamics/Coach-RL',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in sports handoff history; not traceable on current crispy-waddle main at REF-PROV-01 audit time.',
    evidence: [
      {
        evidenceId: 'handoff:sports:coach-rl',
        kind: 'HANDOFF_NOTE',
        locator: 'urn:jhadina:handoff:sports:coach-rl',
      },
    ],
  },
  {
    referenceId: 'github:Verified-Intelligence/alpha-beta-CROWN',
    canonicalName: 'alpha-beta-CROWN',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE', 'SECURITY_REFERENCE'],
    canonicalLocator:
      'https://github.com/Verified-Intelligence/alpha-beta-CROWN',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in sports handoff history; no durable mapping found on current crispy-waddle main.',
    evidence: [
      {
        evidenceId: 'handoff:sports:alpha-beta-crown',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:sports:alpha-beta-crown',
      },
    ],
  },
  {
    referenceId: 'github:pump-fun/pump-public-docs',
    canonicalName: 'pump-public-docs',
    kind: 'GITHUB_REPOSITORY',
    roles: ['API_PROVIDER', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator:
      'https://github.com/pump-fun/pump-public-docs',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in SHARK handoff history. REF-PROV-01 does not infer implementation merely from the handoff.',
    evidence: [
      {
        evidenceId: 'handoff:shark:pump-public-docs',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:shark:pump-public-docs',
      },
    ],
  },
  {
    referenceId: 'github:keidev-sol/Meteora-Rug-Bot',
    canonicalName: 'Meteora-Rug-Bot',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE', 'SECURITY_REFERENCE'],
    canonicalLocator:
      'https://github.com/keidev-sol/Meteora-Rug-Bot',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in SHARK handoff history. Current repo contains Meteora intelligence code, but REF-PROV-01 found no durable link proving this repository is its source.',
    evidence: [
      {
        evidenceId: 'handoff:shark:meteora-rug-bot',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:shark:meteora-rug-bot',
      },
    ],
  },
  {
    referenceId:
      'github:baronguyen001/wallet-cluster-detector',
    canonicalName: 'wallet-cluster-detector',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ALGORITHM_REFERENCE'],
    canonicalLocator:
      'https://github.com/baronguyen001/wallet-cluster-detector',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in SHARK handoff history; no durable source-to-implementation mapping found on current main.',
    evidence: [
      {
        evidenceId: 'handoff:shark:wallet-cluster-detector',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:shark:wallet-cluster-detector',
      },
    ],
  },
  {
    referenceId: 'github:assafelovic/gpt-researcher',
    canonicalName: 'GPT Researcher',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator:
      'https://github.com/assafelovic/gpt-researcher',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in Knowledge/research handoff history; not traceable on current main.',
    evidence: [
      {
        evidenceId: 'handoff:knowledge:gpt-researcher',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:knowledge:gpt-researcher',
      },
    ],
  },
  {
    referenceId: 'github:dzhng/deep-research',
    canonicalName: 'deep-research',
    kind: 'GITHUB_REPOSITORY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator:
      'https://github.com/dzhng/deep-research',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in Knowledge/research handoff history; not traceable on current main.',
    evidence: [
      {
        evidenceId: 'handoff:knowledge:deep-research',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:knowledge:deep-research',
      },
    ],
  },
  {
    referenceId: 'github:XecureLogic/policy-gate',
    canonicalName: 'policy-gate',
    kind: 'GITHUB_REPOSITORY',
    roles: ['SECURITY_REFERENCE', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator:
      'https://github.com/XecureLogic/policy-gate',
    discoveredFrom: 'HANDOFF',
    traceabilityStatus: 'HANDOFF_ONLY',
    licenseStatus: 'UNKNOWN',
    notes:
      'Named in Knowledge/research handoff history. Similar policy-gateway naming in current repo is not treated as proof of derivation.',
    evidence: [
      {
        evidenceId: 'handoff:knowledge:policy-gate',
        kind: 'HANDOFF_NOTE',
        locator:
          'urn:jhadina:handoff:knowledge:policy-gate',
      },
    ],
  },
];

const mappings: readonly RegisterMappingInput[] = [
  {
    mappingId: 'map:pupsonstuff:godot-engine-plan',
    referenceId: 'github:godotengine/godot',
    subsystem: 'PupsonStuff',
    targetPaths: [
      'apps/pupsonstuff/.pupsonstuff-engine-plan.md',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: [
      'engine-style interactive product-scene behavior',
    ],
    adaptationNotes:
      'Reference is explicitly inspirational. The plan keeps Next.js/Three.js as the web storefront foundation rather than embedding Godot.',
    adoptionStatus: 'PLANNED',
    implementationEvidence: [
      {
        evidenceId: 'repo:pupsonstuff-plan:godot-mapping',
        kind: 'REPO_PATH',
        locator:
          'repo:apps/pupsonstuff/.pupsonstuff-engine-plan.md',
      },
    ],
  },
  {
    mappingId: 'map:pupsonstuff:turbulenz-engine-plan',
    referenceId: 'github:turbulenz/turbulenz_engine',
    subsystem: 'PupsonStuff',
    targetPaths: [
      'apps/pupsonstuff/.pupsonstuff-engine-plan.md',
    ],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: [
      'engine-style interactive product-scene behavior',
    ],
    adaptationNotes:
      'Reference is inspirational only; the plan explicitly avoids embedding a second full engine runtime.',
    adoptionStatus: 'PLANNED',
    implementationEvidence: [
      {
        evidenceId:
          'repo:pupsonstuff-plan:turbulenz-mapping',
        kind: 'REPO_PATH',
        locator:
          'repo:apps/pupsonstuff/.pupsonstuff-engine-plan.md',
      },
    ],
  },
  {
    mappingId: 'map:shark:dexscreener-ingest',
    referenceId: 'api:dexscreener',
    subsystem: 'SHARK',
    targetPaths: [
      'packages/shark-intelligence-core/src/meme-trader/dexscreener-event-ingest.ts',
      'packages/shark-intelligence-core/src/meme-trader/pool-discovery.ts',
    ],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: [
      'candidate-pool discovery boundary',
      'untrusted provider payload normalization',
    ],
    adaptationNotes:
      'DexScreener is treated as a provider boundary and candidate-discovery source, not as execution authority or a historical reserve oracle.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:shark:dexscreener-event-ingest',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/dexscreener-event-ingest.ts',
      },
      {
        evidenceId: 'repo:shark:dexscreener-pool-discovery',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/pool-discovery.ts',
      },
    ],
  },
];

export function createInitialReferenceProvenanceRegistry():
  ReferenceProvenanceRegistry {
  const registry = new ReferenceProvenanceRegistry();
  for (const reference of [
    ...tracedReferences,
    ...handoffOnlyReferences,
  ]) {
    registry.registerReference(reference);
  }
  for (const mapping of mappings) {
    registry.registerMapping(mapping);
  }
  registry.assertIntegrity();
  return registry;
}

export const INITIAL_REFERENCE_IDS = Object.freeze(
  [...tracedReferences, ...handoffOnlyReferences]
    .map((reference) => reference.referenceId)
    .sort((a, b) => a.localeCompare(b)),
);
