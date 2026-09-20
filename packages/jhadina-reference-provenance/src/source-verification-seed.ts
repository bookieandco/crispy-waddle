import type { ReferenceProvenanceRegistry } from './index.js';
import {
  ReferenceSourceVerificationRegistry,
  type RegisterReferenceSourceVerificationInput,
} from './source-verification.js';

const VERIFIED_AT = '2026-09-20T04:00:00Z';

function git(
  referenceId: string,
  repository: string,
  revision: string,
  defaultBranch: string,
  license:
    | Readonly<{ expression: string; path: string }>
    | undefined,
  note?: string,
): RegisterReferenceSourceVerificationInput {
  const upstreamLocator = `https://github.com/${repository}`;
  const revisionLocator =
    `${upstreamLocator}/commit/${revision}`;
  return {
    verificationId: `source:${referenceId}`,
    referenceId,
    status: 'VERIFIED',
    sourceKind: 'GIT_REPOSITORY',
    upstreamLocator,
    revision: {
      kind: 'GIT_COMMIT',
      value: revision,
      defaultBranch,
    },
    sourceDigest: `git-commit:${revision}`,
    license: license
      ? {
          status: 'VERIFIED',
          expression: license.expression,
          evidenceLocator:
            `${upstreamLocator}/blob/${revision}/${license.path}`,
        }
      : {
          status: 'UNKNOWN',
          note:
            'Upstream identity and revision are verified, but REF-PROV-03 does not have a single verified SPDX-compatible license claim for this source.',
        },
    verifiedAt: VERIFIED_AT,
    evidence: Object.freeze([
      {
        evidenceId: `upstream:${referenceId}`,
        kind: 'UPSTREAM_REPOSITORY',
        locator: upstreamLocator,
      },
      {
        evidenceId: `revision:${referenceId}`,
        kind: 'IMMUTABLE_REVISION',
        locator: revisionLocator,
      },
      ...(license
        ? [
            {
              evidenceId: `license:${referenceId}`,
              kind: 'LICENSE_FILE' as const,
              locator:
                `${upstreamLocator}/blob/${revision}/${license.path}`,
            },
          ]
        : []),
    ]),
    note,
  };
}

export const INITIAL_SOURCE_VERIFICATIONS:
  readonly RegisterReferenceSourceVerificationInput[] =
  Object.freeze([
    git(
      'github:godotengine/godot',
      'godotengine/godot',
      '57277407e77e61b161f35dbd7aeb510f7a9e26a6',
      'master',
      { expression: 'MIT', path: 'LICENSE.txt' },
    ),
    git(
      'github:turbulenz/turbulenz_engine',
      'turbulenz/turbulenz_engine',
      '403ef0dadbe93aac3122928441cc0cb8b075b1cf',
      'master',
      { expression: 'MIT', path: 'LICENSE' },
    ),
    git(
      'provider:reticulum',
      'markqvist/Reticulum',
      '99de23c040d507e3fefca19e87b182302902725d',
      'master',
      undefined,
      'GitHub reports a non-standard/other license; source is pinned, license remains unresolved.',
    ),
    git(
      'provider:comfyui',
      'Comfy-Org/ComfyUI',
      'c8ed2c8ce957475459731135c4ca31c6856a4542',
      'master',
      { expression: 'GPL-3.0', path: 'LICENSE' },
      'Official upstream is Comfy-Org/ComfyUI.',
    ),
    git(
      'model:sam2',
      'facebookresearch/sam2',
      '2b90b9f5ceec907a1c18123530e92e794ad901a4',
      'main',
      { expression: 'Apache-2.0', path: 'LICENSE' },
    ),
    git(
      'music:voicefixer',
      'haoheliu/voicefixer',
      'aae2253c85f97a87b844b6832384de249c23ab37',
      'main',
      { expression: 'MIT', path: 'LICENSE' },
    ),
    git(
      'music:neuralnote',
      'DamRsn/NeuralNote',
      '20ca45ad7b4429dea05a9321020b62bf2ff32fae',
      'master',
      { expression: 'Apache-2.0', path: 'LICENSE' },
      'Resolved to DamRsn/NeuralNote, the upstream audio-to-MIDI project named by the restoration notes.',
    ),
    git(
      'music:chow-tape-model',
      'jatinchowdhury18/AnalogTapeModel',
      '604372e4ffd9690c3e283362e4598cb43edbb475',
      'master',
      { expression: 'GPL-3.0', path: 'LICENSE' },
      'Resolved CHOW Tape Model to its AnalogTapeModel upstream.',
    ),
    git(
      'music:dawdreamer',
      'DBraun/DawDreamer',
      '727469f1317e96d0acee80d19fd57aeb0dbd0948',
      'main',
      { expression: 'GPL-3.0', path: 'LICENSE' },
    ),
    git(
      'music:musescore',
      'musescore/MuseScore',
      '2b540fe37ae7009b06b79301f233c9c2db6b651c',
      'main',
      undefined,
      'Repository pinned; GitHub reports a non-standard/other license classification, so this phase does not simplify it to a single SPDX expression.',
    ),
    git(
      'music:ffmpeg-audio-mixer',
      'FFmpeg/FFmpeg',
      'f5b66388088b33c8e994be083d31fc48734d629d',
      'master',
      undefined,
      'Repository pinned; FFmpeg licensing depends on build/configuration, so a single license expression is intentionally not asserted here.',
    ),
    git(
      'provider:supabase',
      'supabase/supabase',
      '2a75ff7ae6e0059b34f2c242febd2916d17fc5de',
      'master',
      { expression: 'Apache-2.0', path: 'LICENSE' },
    ),
    git(
      'github:maariia-saez/MDP-Adaptive-GA',
      'maariia-saez/MDP-Adaptive-GA',
      '1f4ff9a461e37b7b7bd36223554bca3213ea9474',
      'main',
      { expression: 'MIT', path: 'LICENSE' },
      'Upstream existence/license is verified. The claimed Sports implementation relationship remains handoff-only until repository evidence proves it.',
    ),
    git(
      'github:yinzhangyue/SelfAware',
      'yinzhangyue/SelfAware',
      'f0bad1ff77bd42fc4eb2360281ed646c7bb7bd0c',
      'main',
      { expression: 'Apache-2.0', path: 'LICENSE' },
      'Upstream verified; Sports source-to-implementation relationship remains unverified.',
    ),
    git(
      'github:RC-Dynamics/Coach-RL',
      'RC-Dynamics/Coach-RL',
      'cc791ec0121b3c3e0c5fed14fc26648713381bcf',
      'master',
      undefined,
      'Upstream verified but no license is asserted; Sports relationship remains handoff-only.',
    ),
    git(
      'github:Verified-Intelligence/alpha-beta-CROWN',
      'Verified-Intelligence/alpha-beta-CROWN',
      'e5c7e17bf0488843acb77b7519f59876717a49f4',
      'main',
      undefined,
      'Upstream verified; GitHub license classification is non-standard/other and the Sports relationship remains handoff-only.',
    ),
    git(
      'github:pump-fun/pump-public-docs',
      'pump-fun/pump-public-docs',
      '81091419e4457566469d4e2a27f64ed84d42419c',
      'main',
      undefined,
      'Upstream docs repository verified. No license or SHARK implementation derivation is inferred.',
    ),
    git(
      'github:keidev-sol/Meteora-Rug-Bot',
      'keidev-sol/Meteora-Rug-Bot',
      '5731509c4866d2e48c3e6f1dad6525e2cdd0f872',
      'main',
      undefined,
      'Upstream verified. Existing Meteora code in Jhadina still does not prove derivation from this repository.',
    ),
    git(
      'github:baronguyen001/wallet-cluster-detector',
      'baronguyen001/wallet-cluster-detector',
      'e4b6d75c75ffa3d40f61f974998b097128957355',
      'main',
      { expression: 'MIT', path: 'LICENSE' },
      'Upstream verified; SHARK source-to-implementation relationship remains handoff-only.',
    ),
    git(
      'github:assafelovic/gpt-researcher',
      'assafelovic/gpt-researcher',
      '6f998577d547b1e54ec662dac63583aa11e3b84b',
      'main',
      { expression: 'Apache-2.0', path: 'LICENSE' },
      'Upstream verified; Knowledge implementation relationship remains handoff-only.',
    ),
    git(
      'github:dzhng/deep-research',
      'dzhng/deep-research',
      '1f8f3e285bbc23e80b98a66a64effab9069f3ad4',
      'main',
      { expression: 'MIT', path: 'LICENSE' },
      'Upstream verified; Knowledge implementation relationship remains handoff-only.',
    ),
    git(
      'github:XecureLogic/policy-gate',
      'XecureLogic/policy-gate',
      'a1fae85a6294098b0deed51c1c50ecf3000ec41f',
      'main',
      { expression: 'Apache-2.0', path: 'LICENSE' },
      'Upstream verified; a similarly named local policy boundary is not treated as evidence of derivation.',
    ),
  ]);

export function createInitialSourceVerificationRegistry(
  references: ReferenceProvenanceRegistry,
): ReferenceSourceVerificationRegistry {
  const registry =
    new ReferenceSourceVerificationRegistry(references);
  for (const verification of INITIAL_SOURCE_VERIFICATIONS) {
    registry.register(verification);
  }
  registry.assertIntegrity();
  return registry;
}
