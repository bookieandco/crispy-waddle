import type {
  ReferenceProvenanceRegistry,
  RegisterArtifactPinInput,
  RegisterProviderContractInput,
} from './index.js';

const VERIFIED_AT = '2026-09-20T04:20:00Z';

export const REF_PROV_04_PROVIDER_CONTRACTS:
  readonly RegisterProviderContractInput[] = [
  {
    contractId: 'contract:plaid:accounts-get:2020-09-14',
    referenceId: 'api:plaid',
    providerId: 'plaid',
    protocol: 'HTTP',
    baseLocator: 'urn:provider:plaid',
    versionStrategy: 'HEADER',
    versionValue: 'Plaid-Version=2020-09-14',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'accounts.get',
        method: 'POST',
        pathTemplate: '/accounts/get',
        requiredRequestHeaders: [
          'content-type',
          'PLAID-CLIENT-ID',
          'PLAID-SECRET',
          'Plaid-Version',
        ],
        requiredRequestFields: ['access_token'],
        requiredResponseFields: ['accounts'],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:money:plaid-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/money-core/src/plaid-read-only-adapter.ts',
      },
      {
        evidenceId: 'url:plaid:versioning',
        kind: 'URL',
        locator: 'https://plaid.com/docs/api/versioning/',
      },
    ],
  },
  {
    contractId: 'contract:stripe:payments:2026-08-26.dahlia',
    referenceId: 'api:stripe',
    providerId: 'stripe',
    protocol: 'HTTP',
    baseLocator: 'https://api.stripe.com',
    versionStrategy: 'HEADER',
    versionValue: 'Stripe-Version=2026-08-26.dahlia',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'payment_intent.create',
        method: 'POST',
        pathTemplate: '/v1/payment_intents',
        requiredRequestHeaders: [
          'authorization',
          'content-type',
          'Idempotency-Key',
          'Stripe-Version',
        ],
        requiredRequestFields: [
          'amount',
          'automatic_payment_methods.allow_redirects',
          'automatic_payment_methods.enabled',
          'confirm',
          'currency',
          'payment_method',
        ],
        requiredResponseFields: [
          'amount',
          'currency',
          'id',
          'status',
        ],
      },
      {
        operationId: 'payment_intent.capture',
        method: 'POST',
        pathTemplate: '/v1/payment_intents/{paymentIntentId}/capture',
        requiredRequestHeaders: [
          'authorization',
          'content-type',
          'Stripe-Version',
        ],
        requiredRequestFields: [],
        requiredResponseFields: ['id', 'status'],
      },
      {
        operationId: 'refund.create',
        method: 'POST',
        pathTemplate: '/v1/refunds',
        requiredRequestHeaders: [
          'authorization',
          'content-type',
          'Idempotency-Key',
          'Stripe-Version',
        ],
        requiredRequestFields: ['payment_intent', 'reason'],
        requiredResponseFields: [
          'id',
          'payment_intent',
          'status',
        ],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:commerce:stripe-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts',
      },
      {
        evidenceId: 'url:stripe:versioning',
        kind: 'URL',
        locator: 'https://docs.stripe.com/api/versioning',
      },
    ],
  },
  {
    contractId: 'contract:anthropic:messages:2023-06-01',
    referenceId: 'api:anthropic',
    providerId: 'anthropic',
    protocol: 'HTTP',
    baseLocator: 'https://api.anthropic.com',
    versionStrategy: 'HEADER',
    versionValue: 'anthropic-version=2023-06-01',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'messages.create',
        method: 'POST',
        pathTemplate: '/v1/messages',
        requiredRequestHeaders: [
          'anthropic-version',
          'content-type',
          'x-api-key',
        ],
        requiredRequestFields: [
          'max_tokens',
          'messages',
          'model',
          'system',
        ],
        requiredResponseFields: ['content'],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:intelligence:anthropic-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/jhadina-intelligence-core/src/anthropic-model-provider.ts',
      },
      {
        evidenceId: 'url:anthropic:messages-version',
        kind: 'URL',
        locator: 'https://docs.anthropic.com/en/api/messages',
      },
    ],
  },
  {
    contractId: 'contract:shodan:readonly:2026-09-20',
    referenceId: 'api:shodan',
    providerId: 'shodan',
    protocol: 'HTTP',
    baseLocator: 'https://api.shodan.io',
    versionStrategy: 'CONTRACT_DIGEST',
    versionValue: 'unversioned-source-snapshot:2026-09-20',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'host.read',
        method: 'GET',
        pathTemplate: '/shodan/host/{subject}',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: ['key'],
        requiredResponseFields: [],
      },
      {
        operationId: 'dns.read',
        method: 'GET',
        pathTemplate: '/dns/resolve',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: ['hostnames', 'key'],
        requiredResponseFields: [],
      },
      {
        operationId: 'search.read',
        method: 'GET',
        pathTemplate: '/shodan/host/search',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: ['key', 'query'],
        requiredResponseFields: [],
      },
      {
        operationId: 'history.read',
        method: 'GET',
        pathTemplate: '/shodan/host/{subject}',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: ['history=true', 'key'],
        requiredResponseFields: [],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:intelligence:shodan-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/jhadina-intelligence-core/src/shodan-http-transport.ts',
      },
    ],
  },
  {
    contractId: 'contract:shodan:internetdb:2026-09-20',
    referenceId: 'api:shodan',
    providerId: 'shodan-internetdb',
    protocol: 'HTTP',
    baseLocator: 'https://internetdb.shodan.io',
    versionStrategy: 'CONTRACT_DIGEST',
    versionValue: 'unversioned-source-snapshot:2026-09-20',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'internetdb.read',
        method: 'GET',
        pathTemplate: '/{subject}',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: [],
        requiredResponseFields: [],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:intelligence:internetdb-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/jhadina-intelligence-core/src/shodan-http-transport.ts',
      },
    ],
  },
  {
    contractId: 'contract:dexscreener:token-pairs:v1',
    referenceId: 'api:dexscreener',
    providerId: 'dexscreener',
    protocol: 'HTTP',
    baseLocator: 'https://api.dexscreener.com',
    versionStrategy: 'PATH',
    versionValue: 'v1',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'token-pairs.get',
        method: 'GET',
        pathTemplate: '/token-pairs/v1/{chainId}/{tokenAddress}',
        requiredRequestHeaders: [],
        requiredRequestFields: [],
        requiredResponseFields: [
          'baseToken.address',
          'pairAddress',
        ],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:shark:dexscreener-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/pool-discovery.ts',
      },
      {
        evidenceId: 'url:dexscreener:token-pairs',
        kind: 'URL',
        locator: 'https://docs.dexscreener.com/api/reference',
      },
    ],
  },
  {
    contractId: 'contract:coingecko:onchain:v3',
    referenceId: 'api:coingecko-pro',
    providerId: 'coingecko-pro',
    protocol: 'HTTP',
    baseLocator: 'https://pro-api.coingecko.com/api/v3',
    versionStrategy: 'PATH',
    versionValue: 'v3',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'token.ohlcv',
        method: 'GET',
        pathTemplate:
          '/onchain/networks/{network}/tokens/{tokenAddress}/ohlcv/{timeframe}',
        requiredRequestHeaders: [
          'accept',
          'x-cg-pro-api-key',
        ],
        requiredRequestFields: [
          'aggregate',
          'currency',
          'include_empty_intervals',
          'limit',
        ],
        requiredResponseFields: ['data.attributes.ohlcv_list'],
      },
      {
        operationId: 'token.holders',
        method: 'GET',
        pathTemplate:
          '/onchain/networks/{network}/tokens/{tokenAddress}/holders_chart',
        requiredRequestHeaders: [
          'accept',
          'x-cg-pro-api-key',
        ],
        requiredRequestFields: [],
        requiredResponseFields: ['data.attributes'],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:shark:coingecko-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/coingecko-historical-source.ts',
      },
      {
        evidenceId: 'url:coingecko:onchain-v3',
        kind: 'URL',
        locator: 'https://docs.coingecko.com/',
      },
    ],
  },
  {
    contractId: 'contract:helius:get-transfers:jsonrpc-2.0',
    referenceId: 'api:helius',
    providerId: 'helius',
    protocol: 'JSON_RPC',
    baseLocator: 'https://mainnet.helius-rpc.com',
    versionStrategy: 'PROTOCOL',
    versionValue: 'jsonrpc=2.0;method=getTransfersByAddress',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'getTransfersByAddress',
        method: 'POST',
        pathTemplate: '/',
        requiredRequestHeaders: ['content-type'],
        requiredRequestFields: [
          'id',
          'jsonrpc',
          'method=getTransfersByAddress',
          'params',
        ],
        requiredResponseFields: ['result.data'],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:shark:helius-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/shark-intelligence-core/src/meme-trader/helius-historical-source.ts',
      },
      {
        evidenceId: 'url:helius:get-transfers',
        kind: 'URL',
        locator:
          'https://www.helius.dev/docs/api-reference/rpc/http/gettransfersbyaddress',
      },
    ],
  },
  {
    contractId: 'contract:sam-gov:opportunities:v2',
    referenceId: 'api:sam-gov',
    providerId: 'sam-gov',
    protocol: 'HTTP',
    baseLocator: 'https://api.sam.gov',
    versionStrategy: 'PATH',
    versionValue: 'v2',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'opportunities.search',
        method: 'GET',
        pathTemplate: '/opportunities/v2/search',
        requiredRequestHeaders: ['Accept'],
        requiredRequestFields: ['api_key', 'limit', 'offset'],
        requiredResponseFields: [
          'opportunitiesData',
          'totalRecords',
        ],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:opportunity:sam-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:apps/jhadina-web/src/lib/money-opportunities/sam-config.ts',
      },
      {
        evidenceId: 'url:sam-gov:opportunities-v2',
        kind: 'URL',
        locator:
          'https://open.gsa.gov/api/get-opportunities-public-api/',
      },
    ],
  },
  {
    contractId: 'contract:comfyui:http:c8ed2c8c',
    referenceId: 'provider:comfyui',
    providerId: 'comfyui',
    protocol: 'LOCAL_HTTP',
    baseLocator: 'urn:provider:comfyui-runtime',
    versionStrategy: 'UPSTREAM_REVISION',
    versionValue:
      'c8ed2c8ce957475459731135c4ca31c6856a4542',
    verifiedAt: VERIFIED_AT,
    endpoints: [
      {
        operationId: 'prompt.queue',
        method: 'POST',
        pathTemplate: '/prompt',
        requiredRequestHeaders: ['content-type'],
        requiredRequestFields: ['prompt'],
        requiredResponseFields: ['prompt_id'],
      },
      {
        operationId: 'history.get',
        method: 'GET',
        pathTemplate: '/history/{promptId}',
        requiredRequestHeaders: ['content-type'],
        requiredRequestFields: [],
        requiredResponseFields: [],
      },
      {
        operationId: 'history.list',
        method: 'GET',
        pathTemplate: '/history',
        requiredRequestHeaders: ['content-type'],
        requiredRequestFields: [],
        requiredResponseFields: [],
      },
      {
        operationId: 'prompt.interrupt',
        method: 'POST',
        pathTemplate: '/interrupt',
        requiredRequestHeaders: ['content-type'],
        requiredRequestFields: ['prompt_id'],
        requiredResponseFields: [],
      },
    ],
    evidence: [
      {
        evidenceId: 'repo:director:comfyui-contract',
        kind: 'REPO_PATH',
        locator:
          'repo:packages/director-core/src/comfyui-http.ts',
      },
      {
        evidenceId: 'commit:comfyui:contract-source',
        kind: 'COMMIT',
        locator:
          'https://github.com/Comfy-Org/ComfyUI/commit/c8ed2c8ce957475459731135c4ca31c6856a4542',
      },
    ],
  },
];

export const REF_PROV_04_ARTIFACT_PINS:
  readonly RegisterArtifactPinInput[] = [
  {
    pinId: 'artifact:sam2:checkpoint',
    referenceId: 'model:sam2',
    artifactId: 'sam2:runtime-checkpoint',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'REQUIRED_UNRESOLVED',
    locator: 'urn:artifact:sam2:runtime-checkpoint',
    sourceRevision:
      '2b90b9f5ceec907a1c18123530e92e794ad901a4',
    digestAlgorithm: 'SHA256',
    evidence: [
      {
        evidenceId: 'repo:tracking:sam2-artifact-boundary',
        kind: 'REPO_PATH',
        locator: 'repo:services/tracking-service/worker.py',
      },
    ],
    notes:
      'The worker accepts an injected SAM2 engine but current repository state does not identify a concrete checkpoint file. Production composition must provide a SHA-256 pin before the artifact can be admitted.',
  },
  {
    pinId: 'artifact:comfyui:model-bundle',
    referenceId: 'provider:comfyui',
    artifactId: 'comfyui:runtime-model-bundle',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'REQUIRED_UNRESOLVED',
    locator: 'urn:artifact:comfyui:runtime-model-bundle',
    sourceRevision:
      'c8ed2c8ce957475459731135c4ca31c6856a4542',
    digestAlgorithm: 'SHA256',
    evidence: [
      {
        evidenceId: 'repo:director:comfyui-artifact-boundary',
        kind: 'REPO_PATH',
        locator: 'repo:packages/director-core/src/comfyui-http.ts',
      },
    ],
    notes:
      'ComfyUI transport is pinned, but the model/checkpoint bundle selected by a runtime deployment is not identified in repo state.',
  },
  {
    pinId: 'artifact:voicefixer:model-weights',
    referenceId: 'music:voicefixer',
    artifactId: 'voicefixer:model-weights',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'REQUIRED_UNRESOLVED',
    locator: 'urn:artifact:voicefixer:model-weights',
    sourceRevision:
      'aae2253c85f97a87b844b6832384de249c23ab37',
    digestAlgorithm: 'SHA256',
    evidence: [
      {
        evidenceId: 'repo:music:voicefixer-artifact-plan',
        kind: 'REPO_PATH',
        locator:
          'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md',
      },
    ],
    notes:
      'Design reference is verified, but no production model-weight artifact has been admitted.',
  },
  {
    pinId: 'artifact:neuralnote:model',
    referenceId: 'music:neuralnote',
    artifactId: 'neuralnote:runtime-model',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'REQUIRED_UNRESOLVED',
    locator: 'urn:artifact:neuralnote:runtime-model',
    sourceRevision:
      '20ca45ad7b4429dea05a9321020b62bf2ff32fae',
    digestAlgorithm: 'SHA256',
    evidence: [
      {
        evidenceId: 'repo:music:neuralnote-artifact-plan',
        kind: 'REPO_PATH',
        locator:
          'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md',
      },
    ],
    notes:
      'No concrete model artifact is bundled or pinned by the current repository.',
  },
  {
    pinId: 'artifact:ace-step:model',
    referenceId: 'music:ace-step',
    artifactId: 'ace-step:runtime-model',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'REQUIRED_UNRESOLVED',
    locator: 'urn:artifact:ace-step:runtime-model',
    digestAlgorithm: 'SHA256',
    evidence: [
      {
        evidenceId: 'repo:music:ace-step-artifact-plan',
        kind: 'REPO_PATH',
        locator:
          'repo:docs/music-restoration/CLAUDE_MUSIC_RESTORATION_NOTES.md',
      },
    ],
    notes:
      'Exact upstream and model artifact remain unresolved; generative reconstruction is not production-admissible through this pin.',
  },
];

export function registerRefProv04Seeds(
  registry: ReferenceProvenanceRegistry,
): void {
  for (const contract of REF_PROV_04_PROVIDER_CONTRACTS) {
    registry.registerProviderContract(contract);
  }
  for (const pin of REF_PROV_04_ARTIFACT_PINS) {
    registry.registerArtifactPin(pin);
  }
}
