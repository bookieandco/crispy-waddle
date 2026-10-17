import type { DispatcherBrief, IDispatcherReasoner } from "../interfaces/dispatcher.js";

/**
 * Deterministic, template-based IDispatcherReasoner. PR #86 defined the
 * port but shipped no adapter; this is the MVP concrete implementation —
 * and, like MockPlacesProvider, it is NOT a live language model call. It
 * composes a narrative purely from the fields already present on the
 * DispatcherBrief it's given (headline, per-candidate reasons, warnings)
 * plus the driver's own question, and never invents a number that isn't
 * already in `brief`. Swapping in a real LLM-backed IDispatcherReasoner
 * later (e.g. one that calls out to Claude) is a drop-in replacement
 * behind this same interface — see README.md "AI reasoning stays
 * advisory" — and should still be constrained to explaining `brief`
 * rather than being handed the raw loads and asked to redo the math.
 */
export class TemplateDispatcherReasoner implements IDispatcherReasoner {
  async explain(brief: DispatcherBrief, question?: string): Promise<string> {
    const sentences: string[] = [];

    const trimmedQuestion = question?.trim();
    if (trimmedQuestion) {
      sentences.push(`You asked: "${trimmedQuestion}"`);
    }

    if (brief.candidates.length === 0) {
      sentences.push(brief.headline);
      return sentences.join(" ");
    }

    sentences.push(brief.headline);

    const best = brief.candidates[0];
    sentences.push(`Why: ${best.reasons.join(" ")}`);

    if (brief.candidates.length > 1) {
      const runnerUp = brief.candidates[1];
      const runnerUpPerMile = (runnerUp.economics.netCentsPerMile / 100).toFixed(2);
      sentences.push(
        `${brief.candidates.length - 1} other load${brief.candidates.length > 2 ? "s were" : " was"} ` +
          `also evaluated; the next best is ${runnerUp.load.origin} → ${runnerUp.load.destination} ` +
          `at $${runnerUpPerMile}/mile.`
      );
    }

    if (brief.warnings.length > 0) {
      sentences.push(`Note: ${brief.warnings.join(" ")}`);
    }

    sentences.push(
      "This is a recommendation, not a booking — nothing is committed until you approve it."
    );

    return sentences.join(" ");
  }
}
