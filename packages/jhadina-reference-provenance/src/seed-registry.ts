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


const repositoryWideReferences: readonly RegisterReferenceInput[] = [
  {
    referenceId: 'api:plaid',
    canonicalName: 'Plaid API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://sandbox.plaid.com',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'Money Core contains a read-only Plaid account adapter. Provider integration provenance is distinct from runtime financial evidence.',
    evidence: [{ evidenceId: 'repo:money:plaid-adapter', kind: 'REPO_PATH', locator: 'repo:packages/money-core/src/plaid-read-only-adapter.ts' }],
  },
  {
    referenceId: 'api:stripe',
    canonicalName: 'Stripe API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER'],
    canonicalLocator: 'https://api.stripe.com',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'Commerce implements Stripe test-mode PaymentIntent/refund shapes behind the governed payment boundary.',
    evidence: [{ evidenceId: 'repo:commerce:stripe-sandbox-provider', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts' }],
  },
  {
    referenceId: 'api:anthropic',
    canonicalName: 'Anthropic Messages API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'MODEL_REFERENCE'],
    canonicalLocator: 'https://api.anthropic.com',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'Intelligence Core uses a raw fetch provider boundary for the Messages API. Model output remains proposal data, not authority.',
    evidence: [{ evidenceId: 'repo:intelligence:anthropic-provider', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/anthropic-model-provider.ts' }],
  },
  {
    referenceId: 'api:shodan',
    canonicalName: 'Shodan API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://api.shodan.io',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'Read-only Shodan and InternetDB transport endpoints are explicit in Intelligence Core.',
    evidence: [{ evidenceId: 'repo:intelligence:shodan-http', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/shodan-http-transport.ts' }],
  },
  {
    referenceId: 'api:coingecko-pro',
    canonicalName: 'CoinGecko Pro API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://pro-api.coingecko.com/api/v3',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'SHARK uses CoinGecko historical on-chain observations as evidence inputs.',
    evidence: [{ evidenceId: 'repo:shark:coingecko-history', kind: 'REPO_PATH', locator: 'repo:packages/shark-intelligence-core/src/meme-trader/coingecko-historical-source.ts' }],
  },
  {
    referenceId: 'api:helius',
    canonicalName: 'Helius RPC',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://mainnet.helius-rpc.com',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'SHARK uses Helius historical transfer RPC data behind a bounded source adapter.',
    evidence: [{ evidenceId: 'repo:shark:helius-history', kind: 'REPO_PATH', locator: 'repo:packages/shark-intelligence-core/src/meme-trader/helius-historical-source.ts' }],
  },
  {
    referenceId: 'api:sam-gov',
    canonicalName: 'SAM.gov Contract Opportunities API',
    kind: 'API_DOCUMENTATION',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'https://api.sam.gov/opportunities/v2/search',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'NOT_APPLICABLE',
    notes: 'Opportunity ingestion contains an explicit SAM.gov API configuration/client boundary.',
    evidence: [
      { evidenceId: 'repo:opportunity:sam-config', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/money-opportunities/sam-config.ts' },
      { evidenceId: 'repo:opportunity:sam-client', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/money-opportunities/sam-client.ts' },
    ],
  },
  {
    referenceId: 'provider:reticulum',
    canonicalName: 'Reticulum',
    kind: 'LIBRARY',
    roles: ['API_PROVIDER', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:external:reticulum',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Current repository proves a Reticulum transport adapter exists, but does not provide a canonical upstream URL or verified license record.',
    evidence: [
      { evidenceId: 'repo:intelligence:reticulum-adapter', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/reticulum-adapter.ts' },
      { evidenceId: 'repo:intelligence:intcom-architecture', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_INTCOM_ARCHITECTURE.md' },
    ],
  },
  {
    referenceId: 'provider:comfyui',
    canonicalName: 'ComfyUI',
    kind: 'LIBRARY',
    roles: ['API_PROVIDER', 'MODEL_REFERENCE'],
    canonicalLocator: 'urn:external:comfyui',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Director Core contains a thin ComfyUI HTTP transport and intentionally keeps workflow/node details behind a builder.',
    evidence: [{ evidenceId: 'repo:director:comfyui-http', kind: 'REPO_PATH', locator: 'repo:packages/director-core/src/comfyui-http.ts' }],
  },
  {
    referenceId: 'provider:supabase',
    canonicalName: 'Supabase',
    kind: 'LIBRARY',
    roles: ['API_PROVIDER', 'DATA_SOURCE'],
    canonicalLocator: 'urn:external:supabase',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Supabase is a cross-cutting persistence/auth provider across Jhadina. REF-PROV records the integration relationship, not database truth or authorization.',
    evidence: [
      { evidenceId: 'repo:web:supabase-service-role', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/supabase/service-role.ts' },
      { evidenceId: 'repo:action:supabase-audit-ledger', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-action-core/src/supabase-audit-ledger.ts' },
    ],
  },
  {
    referenceId: 'model:sam2',
    canonicalName: 'SAM2',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'urn:external:model:sam2',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Tracking service defines a bounded SAM2 engine contract; model output is forced to inferred/unapproved evidence.',
    evidence: [{ evidenceId: 'repo:tracking:sam2-worker', kind: 'REPO_PATH', locator: 'repo:services/tracking-service/worker.py' }],
  },
  {
    referenceId: 'music:voicefixer',
    canonicalName: 'VoiceFixer',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'urn:reference:music:voicefixer',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Music restoration notes explicitly map VoiceFixer to a specialized restoration candidate role.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:voicefixer', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:sony-singer-identity',
    canonicalName: 'Sony singer-identity models',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'urn:reference:music:sony-singer-identity',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Music restoration notes constrain this family to identity evidence and retrieval features.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:sony-identity', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:neuralnote',
    canonicalName: 'NeuralNote',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'urn:reference:music:neuralnote',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Music restoration notes use NeuralNote for audio-to-symbolic evidence and explicitly reject transcription-as-truth.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:neuralnote', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:chow-tape-model',
    canonicalName: 'CHOW Tape Model',
    kind: 'LIBRARY',
    roles: ['MODEL_REFERENCE', 'ALGORITHM_REFERENCE'],
    canonicalLocator: 'urn:reference:music:chow-tape-model',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Mapped to tape simulation and transfer-hypothesis generation, not proof of historical state.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:chow-tape', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:dawdreamer',
    canonicalName: 'DawDreamer',
    kind: 'LIBRARY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:reference:music:dawdreamer',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Mapped to controlled programmatic DAW rendering and plugin-graph execution.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:dawdreamer', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:ffmpeg-audio-mixer',
    canonicalName: 'FFmpeg audio mixer',
    kind: 'LIBRARY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:reference:music:ffmpeg-audio-mixer',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Mapped to low-level reassembly/mixing adapter behavior in restoration notes.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:ffmpeg', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:ace-step',
    canonicalName: 'ACE-Step',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE'],
    canonicalLocator: 'urn:reference:music:ace-step',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Mapped only to high-risk generative reconstruction fallback, never default archival recovery.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:ace-step', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'music:musescore',
    canonicalName: 'MuseScore',
    kind: 'LIBRARY',
    roles: ['ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:reference:music:musescore',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Mapped to symbolic musical structure/reference and explicitly denied audio-restoration authority.',
    evidence: [{ evidenceId: 'repo:music:restoration-notes:musescore', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    referenceId: 'justice:statedecoded',
    canonicalName: 'statedecoded',
    kind: 'OTHER',
    roles: ['DATA_SOURCE', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:reference:justice:statedecoded',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Named in the Justice static source catalog described by the current work queue; not a live provider integration.',
    evidence: [{ evidenceId: 'repo:justice:work-queue:statedecoded', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
  },
  {
    referenceId: 'justice:citation-regexes',
    canonicalName: 'citation-regexes',
    kind: 'OTHER',
    roles: ['ALGORITHM_REFERENCE', 'DATA_SOURCE'],
    canonicalLocator: 'urn:reference:justice:citation-regexes',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Named in the Justice static source catalog described by the current work queue; documentation/reference only.',
    evidence: [{ evidenceId: 'repo:justice:work-queue:citation-regexes', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
  },
  {
    referenceId: 'justice:statedb',
    canonicalName: 'statedb',
    kind: 'OTHER',
    roles: ['DATA_SOURCE', 'ARCHITECTURE_REFERENCE'],
    canonicalLocator: 'urn:reference:justice:statedb',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    notes: 'Named in the Justice static source catalog described by the current work queue; documentation/reference only.',
    evidence: [{ evidenceId: 'repo:justice:work-queue:statedb', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
  },
];


const repositoryWideMappings: readonly RegisterMappingInput[] = [
  {
    mappingId: 'map:money:plaid-readonly',
    referenceId: 'api:plaid',
    subsystem: 'Money',
    targetPaths: ['packages/money-core/src/plaid-read-only-adapter.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['read-only account provider boundary', 'Plaid accounts/get request/response shape'],
    adaptationNotes: 'Provider-specific account reads are normalized behind Money Core BankAdapter and cannot create payment or transfer authority.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:money:plaid-map', kind: 'REPO_PATH', locator: 'repo:packages/money-core/src/plaid-read-only-adapter.ts' }],
  },
  {
    mappingId: 'map:commerce:stripe-provider',
    referenceId: 'api:stripe',
    subsystem: 'Commerce',
    targetPaths: ['apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE', 'TEST_PATTERN'],
    borrowedConcepts: ['PaymentIntent request/response shape', 'idempotency headers', 'documented test payment methods'],
    adaptationNotes: 'Stripe API shape is implemented only behind existing checkout/payment governance.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:commerce:stripe-map', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts' }],
  },
  {
    mappingId: 'map:intelligence:anthropic-provider',
    referenceId: 'api:anthropic',
    subsystem: 'Intelligence',
    targetPaths: ['packages/jhadina-intelligence-core/src/anthropic-model-provider.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['Messages API provider transport'],
    adaptationNotes: 'Provider response is parsed into a DecisionProposal and remains non-authoritative.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:intelligence:anthropic-map', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/anthropic-model-provider.ts' }],
  },
  {
    mappingId: 'map:intelligence:shodan-readonly',
    referenceId: 'api:shodan',
    subsystem: 'Intelligence',
    targetPaths: ['packages/jhadina-intelligence-core/src/shodan-http-transport.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['host read', 'InternetDB read', 'DNS/search/history read endpoints'],
    adaptationNotes: 'Only read capabilities are exposed; provider data does not grant trust or action authority.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:intelligence:shodan-map', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/shodan-http-transport.ts' }],
  },
  {
    mappingId: 'map:shark:coingecko-history',
    referenceId: 'api:coingecko-pro',
    subsystem: 'SHARK',
    targetPaths: ['packages/shark-intelligence-core/src/meme-trader/coingecko-historical-source.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['historical OHLCV retrieval'],
    adaptationNotes: 'External historical observations are normalized into SHARK evidence records.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:shark:coingecko-map', kind: 'REPO_PATH', locator: 'repo:packages/shark-intelligence-core/src/meme-trader/coingecko-historical-source.ts' }],
  },
  {
    mappingId: 'map:shark:helius-history',
    referenceId: 'api:helius',
    subsystem: 'SHARK',
    targetPaths: ['packages/shark-intelligence-core/src/meme-trader/helius-historical-source.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['historical transfer RPC observations'],
    adaptationNotes: 'Helius observations are bounded to evidence ingestion; no provider-side execution authority is introduced.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:shark:helius-map', kind: 'REPO_PATH', locator: 'repo:packages/shark-intelligence-core/src/meme-trader/helius-historical-source.ts' }],
  },
  {
    mappingId: 'map:opportunity:sam-gov',
    referenceId: 'api:sam-gov',
    subsystem: 'Opportunity',
    targetPaths: ['apps/jhadina-web/src/lib/money-opportunities/sam-config.ts', 'apps/jhadina-web/src/lib/money-opportunities/sam-client.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['contract-opportunity search API'],
    adaptationNotes: 'SAM.gov is a discovery/data provider. Opportunity qualification and pursuit remain Jhadina-owned decisions.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [
      { evidenceId: 'repo:opportunity:sam-config-map', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/money-opportunities/sam-config.ts' },
      { evidenceId: 'repo:opportunity:sam-client-map', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/money-opportunities/sam-client.ts' },
    ],
  },
  {
    mappingId: 'map:intelligence:reticulum-transport',
    referenceId: 'provider:reticulum',
    subsystem: 'Intelligence',
    targetPaths: ['packages/jhadina-intelligence-core/src/reticulum-adapter.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['Reticulum transport adapter boundary'],
    adaptationNotes: 'Reticulum receives only an already-authorized dispatch and cannot manufacture trust, policy, or approval.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:intelligence:reticulum-map', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-intelligence-core/src/reticulum-adapter.ts' }],
  },
  {
    mappingId: 'map:director:comfyui-http',
    referenceId: 'provider:comfyui',
    subsystem: 'Media/Director',
    targetPaths: ['packages/director-core/src/comfyui-http.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['prompt queue transport', 'history polling', 'workflow isolation'],
    adaptationNotes: 'Director keeps ComfyUI transport mechanics behind a provider client and does not let node IDs become domain contracts.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [{ evidenceId: 'repo:director:comfyui-map', kind: 'REPO_PATH', locator: 'repo:packages/director-core/src/comfyui-http.ts' }],
  },
  {
    mappingId: 'map:platform:supabase-persistence',
    referenceId: 'provider:supabase',
    subsystem: 'Platform',
    targetPaths: ['apps/jhadina-web/src/lib/supabase/service-role.ts', 'packages/jhadina-action-core/src/supabase-audit-ledger.ts'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['server-side persistence', 'auth/session integration', 'durable audit storage'],
    adaptationNotes: 'Supabase supplies infrastructure. Jhadina ownership checks, policy, RLS discipline, and domain invariants remain separate.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [
      { evidenceId: 'repo:platform:supabase-service-role-map', kind: 'REPO_PATH', locator: 'repo:apps/jhadina-web/src/lib/supabase/service-role.ts' },
      { evidenceId: 'repo:platform:supabase-audit-map', kind: 'REPO_PATH', locator: 'repo:packages/jhadina-action-core/src/supabase-audit-ledger.ts' },
    ],
  },
  {
    mappingId: 'map:director:sam2-tracking',
    referenceId: 'model:sam2',
    subsystem: 'Media/Director',
    targetPaths: ['services/tracking-service/worker.py'],
    borrowedArtifactKinds: ['INTERFACE_SHAPE'],
    borrowedConcepts: ['bounded video tracking engine contract'],
    adaptationNotes: 'The worker wraps an injected SAM2-like engine contract and marks model tracks as model-produced and unapproved.',
    adoptionStatus: 'ADAPTED',
    implementationEvidence: [{ evidenceId: 'repo:director:sam2-map', kind: 'REPO_PATH', locator: 'repo:services/tracking-service/worker.py' }],
  },
  {
    mappingId: 'map:music:voicefixer',
    referenceId: 'music:voicefixer',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['specialized vocal/speech restoration candidate'],
    adaptationNotes: 'Design reference only; no code-derivation or runtime-provider claim.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:voicefixer-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:sony-identity',
    referenceId: 'music:sony-singer-identity',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['singer identity evidence', 'retrieval features'],
    adaptationNotes: 'Design reference only; singer identity evidence cannot authorize reconstruction.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:sony-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:neuralnote',
    referenceId: 'music:neuralnote',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['audio-to-symbolic evidence'],
    adaptationNotes: 'Transcription is explicitly treated as evidence, not truth.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:neuralnote-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:chow-tape',
    referenceId: 'music:chow-tape-model',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['tape simulation', 'transfer hypothesis generation'],
    adaptationNotes: 'Simulation can generate hypotheses but cannot prove historical tape state.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:chow-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:dawdreamer',
    referenceId: 'music:dawdreamer',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['programmatic DAW rendering', 'plugin graph execution'],
    adaptationNotes: 'Design reference for a future bounded execution adapter.',
    adoptionStatus: 'PLANNED',
    implementationEvidence: [{ evidenceId: 'repo:music:dawdreamer-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:ffmpeg',
    referenceId: 'music:ffmpeg-audio-mixer',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['low-level reassembly and mixing adapter'],
    adaptationNotes: 'Reference mapping does not claim bundled/copied FFmpeg code.',
    adoptionStatus: 'PLANNED',
    implementationEvidence: [{ evidenceId: 'repo:music:ffmpeg-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:ace-step',
    referenceId: 'music:ace-step',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['high-risk generative reconstruction fallback'],
    adaptationNotes: 'Explicitly never the default archival recovery path.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:ace-step-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:music:musescore',
    referenceId: 'music:musescore',
    subsystem: 'Music',
    targetPaths: ['docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['symbolic musical structure reference'],
    adaptationNotes: 'Symbolic structure is not audio restoration authority.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:music:musescore-map', kind: 'REPO_PATH', locator: 'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md' }],
  },
  {
    mappingId: 'map:justice:statedecoded',
    referenceId: 'justice:statedecoded',
    subsystem: 'Justice',
    targetPaths: ['docs/JHADINA_WORK_QUEUE.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['external legal-data source catalog'],
    adaptationNotes: 'Static discovery/reference catalog only; no live provider or legal authority claim.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:justice:statedecoded-map', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
  },
  {
    mappingId: 'map:justice:citation-regexes',
    referenceId: 'justice:citation-regexes',
    subsystem: 'Justice',
    targetPaths: ['docs/JHADINA_WORK_QUEUE.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['citation parsing reference'],
    adaptationNotes: 'Static discovery/reference catalog only; no code-derivation claim.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:justice:citation-map', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
  },
  {
    mappingId: 'map:justice:statedb',
    referenceId: 'justice:statedb',
    subsystem: 'Justice',
    targetPaths: ['docs/JHADINA_WORK_QUEUE.md'],
    borrowedArtifactKinds: ['IDEA_ONLY'],
    borrowedConcepts: ['legal-data source catalog'],
    adaptationNotes: 'Static discovery/reference catalog only; no live data or legal-authority claim.',
    adoptionStatus: 'EVALUATED',
    implementationEvidence: [{ evidenceId: 'repo:justice:statedb-map', kind: 'REPO_PATH', locator: 'repo:docs/JHADINA_WORK_QUEUE.md' }],
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
    ...repositoryWideReferences,
  ]) {
    registry.registerReference(reference);
  }
  for (const mapping of [...mappings, ...repositoryWideMappings]) {
    registry.registerMapping(mapping);
  }
  registry.assertIntegrity();
  return registry;
}

export const INITIAL_REFERENCE_IDS = Object.freeze(
  [...tracedReferences, ...handoffOnlyReferences, ...repositoryWideReferences]
    .map((reference) => reference.referenceId)
    .sort((a, b) => a.localeCompare(b)),
);
