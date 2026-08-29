export interface ResponseAuditInput {
  draft: string;
  userText: string;
  task: string;
  confidence: number;
}

export interface ResponseAuditResult {
  pass: boolean;
  reasons: string[];
  repairs: string[];
}

/** Lightweight deterministic final-pass guard. It checks for common assistant
 * habits without trying to manufacture "human" behavior or facts. */
export class ConversationalResponseSelfAudit {
  audit(input: ResponseAuditInput): ResponseAuditResult {
    const reasons: string[] = [];
    const repairs: string[] = [];
    const draft = input.draft.trim();

    if (!draft) reasons.push("empty-response");
    if (/^(sure|absolutely|of course|certainly)[!,.]?$/i.test(draft)) {
      reasons.push("generic-acknowledgment-only");
    }
    if (/as an ai language model|as an ai/i.test(draft)) {
      reasons.push("ai-self-reference");
    }
    if (/^(here are|here's|here is)\s+(some|a few|the)\b/i.test(draft) && input.userText.length < 120) {
      reasons.push("premature-listing");
    }
    if (input.confidence < 0.4 && !/\b(not sure|uncertain|unclear|guess|likely|tend to think)\b/i.test(draft)) {
      reasons.push("confidence-mismatch");
    }
    if (draft.length > 2400 && input.task === "conversation") {
      reasons.push("overlong-casual-response");
    }

    if (reasons.includes("generic-acknowledgment-only")) repairs.push("replace acknowledgment with useful substance");
    if (reasons.includes("ai-self-reference")) repairs.push("remove unnecessary AI self-reference");
    if (reasons.includes("confidence-mismatch")) repairs.push("make uncertainty explicit");

    return { pass: reasons.length === 0, reasons, repairs };
  }
}
