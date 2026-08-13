/**
 * Launch-safe manifest for third-party capabilities.
 *
 * These are declarations only: every provider is disabled until configured,
 * authenticated, authorized, and routed through Jhadina's action boundary.
 */

export type ThirdPartyCapabilityManifest = {
  readonly id: string;
  readonly provider: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly requiredCredentials: readonly string[];
  readonly permissions: readonly string[];
  readonly sideEffects: readonly string[];
  readonly enabledByDefault: false;
};

export const THIRD_PARTY_CAPABILITIES: readonly ThirdPartyCapabilityManifest[] = [
  {
    id: "qwen-image",
    provider: "Qwen",
    version: "external",
    capabilities: ["image.generate"],
    requiredCredentials: ["QWEN_API_KEY"],
    permissions: ["ai.generate"],
    sideEffects: ["external.ai.request"],
    enabledByDefault: false,
  },
  {
    id: "minimax",
    provider: "MiniMax",
    version: "external",
    capabilities: ["text.generate", "media.generate"],
    requiredCredentials: ["MINIMAX_API_KEY"],
    permissions: ["ai.generate"],
    sideEffects: ["external.ai.request"],
    enabledByDefault: false,
  },
  {
    id: "nemotron",
    provider: "NVIDIA Nemotron",
    version: "external",
    capabilities: ["reasoning.generate"],
    requiredCredentials: ["NEMOTRON_API_KEY"],
    permissions: ["ai.generate"],
    sideEffects: ["external.ai.request"],
    enabledByDefault: false,
  },
  {
    id: "aaron-marketing",
    provider: "Aaron Marketing Skills",
    version: "external",
    capabilities: ["marketing.plan", "marketing.audit", "marketing.content"],
    requiredCredentials: [],
    permissions: ["marketing.read", "marketing.recommend"],
    sideEffects: ["external.content.processing"],
    enabledByDefault: false,
  },
  {
    id: "claude-seo",
    provider: "Claude SEO",
    version: "external",
    capabilities: ["seo.audit", "seo.optimize", "seo.report"],
    requiredCredentials: [],
    permissions: ["seo.read", "seo.recommend"],
    sideEffects: ["external.web.request"],
    enabledByDefault: false,
  },
  {
    id: "multipost",
    provider: "MultiPost",
    version: "external",
    capabilities: ["social.publish", "social.schedule", "social.analytics"],
    requiredCredentials: ["SOCIAL_PLATFORM_CREDENTIALS"],
    permissions: ["social.read", "social.publish"],
    sideEffects: ["external.social.publish"],
    enabledByDefault: false,
  },
  {
    id: "slack",
    provider: "Slack",
    version: "external",
    capabilities: ["communications.ingress", "communications.reply"],
    requiredCredentials: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"],
    permissions: ["communications.read", "communications.reply"],
    sideEffects: ["external.message.send"],
    enabledByDefault: false,
  },
  {
    id: "kazam",
    provider: "Kazam",
    version: "external",
    capabilities: ["capture.screen", "capture.audio", "capture.video"],
    requiredCredentials: [],
    permissions: ["capture.read"],
    sideEffects: ["local.capture"],
    enabledByDefault: false,
  },
  {
    id: "mubert",
    provider: "Mubert",
    version: "external",
    capabilities: ["music.generate"],
    requiredCredentials: ["MUBERT_API_KEY"],
    permissions: ["music.generate"],
    sideEffects: ["external.ai.request"],
    enabledByDefault: false,
  },
  {
    id: "meetily",
    provider: "Meetily",
    version: "external",
    capabilities: ["meeting.capture", "meeting.transcribe", "meeting.summarize"],
    requiredCredentials: [],
    permissions: ["meeting.read", "meeting.process"],
    sideEffects: ["local.meeting.capture", "external.transcription"],
    enabledByDefault: false,
  },
];

export function getThirdPartyCapability(id: string): ThirdPartyCapabilityManifest | undefined {
  return THIRD_PARTY_CAPABILITIES.find((manifest) => manifest.id === id);
}
