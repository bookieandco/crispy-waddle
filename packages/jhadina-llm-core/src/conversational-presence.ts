export type PresenceMode = "casual" | "focused" | "deep" | "urgent" | "creative";

export interface PresenceContext {
  mode: PresenceMode;
  userRegister: "fragmented" | "casual" | "formal" | "technical";
  affect: "calm" | "positive" | "negative" | "mixed" | "unclear";
  shouldLeadWithAcknowledgment: boolean;
  shouldChallengeWhenUseful: boolean;
  shouldBeConcise: boolean;
}

export interface PresencePolicy {
  select(input: {
    userText: string;
    task?: string;
    affectiveIntensity?: number;
  }): PresenceContext;
}

export class DefaultPresencePolicy implements PresencePolicy {
  select(input: {
    userText: string;
    task?: string;
    affectiveIntensity?: number;
  }): PresenceContext {
    const text = input.userText.trim();
    const fragmented = !/[.!?]$/.test(text) && text.length < 80;
    const technical = /\b(code|repo|github|api|sql|typescript|python|build|debug|test)\b/i.test(text);
    const urgent = /\b(urgent|asap|right now|emergency)\b/i.test(text);
    const creative = /\b(image|video|music|story|design|creative|director)\b/i.test(text);
    const negative = /\b(hate|angry|frustrated|sad|tired|stuck|fuck|shit|broken)\b/i.test(text);
    const positive = /\b(love|excited|great|fire|amazing|dope)\b/i.test(text);
    const intensity = input.affectiveIntensity ?? 0;

    const mode: PresenceMode = urgent
      ? "urgent"
      : technical || input.task === "coding"
        ? "focused"
        : creative || input.task === "creative"
          ? "creative"
          : intensity > 0.65
            ? "deep"
            : "casual";

    return {
      mode,
      userRegister: technical ? "technical" : fragmented ? "fragmented" : text === text.toUpperCase() && text.length > 3 ? "casual" : "casual",
      affect: negative && positive ? "mixed" : negative ? "negative" : positive ? "positive" : "unclear",
      shouldLeadWithAcknowledgment: Boolean(negative || intensity > 0.55),
      shouldChallengeWhenUseful: mode !== "urgent",
      shouldBeConcise: Boolean(urgent || fragmented),
    };
  }
}
