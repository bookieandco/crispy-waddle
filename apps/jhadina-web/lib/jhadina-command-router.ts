export type JhadinaCommandContext = {
  surface?: string;
  entityType?: string;
  entityId?: string;
  selection?: string;
  mediaUri?: string;
  sceneId?: string;
};

export type JhadinaCommandIntent =
  | "make_video"
  | "finish_scene"
  | "extend_video"
  | "make_short"
  | "find_hooks"
  | "create_campaign"
  | "create_landing_page"
  | "research"
  | "draft"
  | "publish"
  | "unknown";

export type JhadinaCommandPlan = {
  intent: JhadinaCommandIntent;
  requiresApproval: boolean;
  context: JhadinaCommandContext;
  steps: string[];
};

const rules: Array<[RegExp, JhadinaCommandIntent]> = [
  [/make\s+(a\s+)?(faceless\s+)?video/i, "make_video"],
  [/finish\s+(this\s+)?scene/i, "finish_scene"],
  [/(make|make it|extend).*(longer|long)/i, "extend_video"],
  [/make\s+(a\s+)?(short|reel|tiktok)/i, "make_short"],
  [/find\s+(the\s+)?(best\s+)?hooks?/i, "find_hooks"],
  [/create\s+(a\s+)?campaign/i, "create_campaign"],
  [/create\s+(a\s+)?landing\s*page/i, "create_landing_page"],
  [/research|look\s+(this|it)\s+up/i, "research"],
  [/draft|write/i, "draft"],
  [/publish|post|send/i, "publish"],
];

export function planJhadinaCommand(text: string, context: JhadinaCommandContext = {}): JhadinaCommandPlan {
  const intent = rules.find(([pattern]) => pattern.test(text))?.[1] ?? "unknown";
  const requiresApproval = intent === "publish";
  const steps = intent === "make_video"
    ? ["capture context", "research and verify", "plan duration", "write script", "generate scenes and visuals", "assemble audio", "render", "prepare thumbnail and short-form variants"]
    : intent === "finish_scene"
      ? ["capture current scene state", "preserve continuity", "generate continuation", "validate transition", "append to timeline"]
      : intent === "make_short"
        ? ["capture source timeline", "identify strongest segment", "reframe to 9:16", "generate captions and graphics", "prepare platform variants"]
        : intent === "find_hooks"
          ? ["transcribe source", "score candidate moments", "rank hooks", "return timestamps and explanations"]
          : intent === "create_landing_page"
            ? ["capture brand and campaign context", "draft landing page", "validate CTA and funnel", "prepare for approval"]
            : ["capture context", "interpret request", "prepare actionable plan"];

  return { intent, requiresApproval, context, steps };
}
