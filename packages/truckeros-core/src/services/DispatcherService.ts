import type {
  DispatcherBrief,
  DispatcherCandidate,
  DispatcherContext,
  LoadEconomics,
  LoadOffer,
} from "../interfaces/dispatcher.js";

/**
 * Deterministic economics and recommendation engine underneath the AI
 * dispatcher. This is intentionally model-free: the LLM can narrate or
 * reason over this result, but it cannot change the arithmetic.
 */
export class DispatcherService {
  calculateEconomics(load: LoadOffer): LoadEconomics {
    const totalMiles = Math.max(0, load.loadedMiles) + Math.max(0, load.deadheadMiles);
    const totalCostsCents =
      Math.max(0, load.fuelCostCents) +
      Math.max(0, load.tollCostCents) +
      Math.max(0, load.otherCostCents);
    const netProfitCents = load.revenueCents - totalCostsCents;

    return {
      grossRevenueCents: load.revenueCents,
      totalMiles,
      totalCostsCents,
      netProfitCents,
      netCentsPerMile: totalMiles > 0 ? netProfitCents / totalMiles : 0,
    };
  }

  rankLoads(context: DispatcherContext): DispatcherCandidate[] {
    return context.loads
      .map((load) => this.evaluateLoad(load, context))
      .sort((a, b) => b.score - a.score);
  }

  brief(context: DispatcherContext): DispatcherBrief {
    const candidates = this.rankLoads(context);
    const best = candidates[0];

    if (!best) {
      return {
        recommendation: "decline",
        headline: "I don't have any loads to evaluate yet.",
        candidates: [],
        warnings: ["No load candidates were supplied."],
      };
    }

    const warnings: string[] = [];
    if (best.economics.totalMiles === 0) warnings.push("Best load has zero reported miles; economics are incomplete.");
    if (best.load.deadheadMiles > best.load.loadedMiles && best.load.loadedMiles > 0) {
      warnings.push("Deadhead is greater than loaded mileage.");
    }

    return {
      recommendation: best.recommendation,
      headline: this.headline(best),
      candidates,
      warnings,
    };
  }

  private evaluateLoad(load: LoadOffer, context: DispatcherContext): DispatcherCandidate {
    const economics = this.calculateEconomics(load);
    const reasons: string[] = [];
    const netPerMile = economics.netCentsPerMile;

    let score = netPerMile;
    if (netPerMile >= context.targetNetCentsPerMile) {
      reasons.push("Meets the target net profit per mile.");
    } else if (netPerMile >= context.minimumNetCentsPerMile) {
      reasons.push("Clears the minimum net profit per mile.");
    } else {
      reasons.push("Below the driver's minimum net profit per mile.");
      score -= 100_000;
    }

    if (load.deadheadMiles <= load.loadedMiles) {
      score += 500;
      reasons.push("Deadhead is within the loaded-mile distance.");
    } else {
      score -= 500;
      reasons.push("High deadhead reduces the attractiveness of this load.");
    }

    const recommendation =
      netPerMile >= context.targetNetCentsPerMile
        ? "accept"
        : netPerMile >= context.minimumNetCentsPerMile
          ? "counter"
          : "decline";

    return { load, economics, recommendation, score, reasons };
  }

  private headline(candidate: DispatcherCandidate): string {
    const dollars = (candidate.economics.netProfitCents / 100).toFixed(2);
    const perMile = (candidate.economics.netCentsPerMile / 100).toFixed(2);
    return `${candidate.recommendation.toUpperCase()}: ${candidate.load.origin} → ${candidate.load.destination}. Estimated net $${dollars} ($${perMile}/mile).`;
  }
}
