export type MarketFeature =
  | "order_book_imbalance"
  | "depth_ratio"
  | "rise_ratio"
  | "spread"
  | "momentum"
  | "volatility"
  | "volume"
  | "regime";

export interface MarketObservation {
  symbol: string;
  timestamp: string;
  features: Partial<Record<MarketFeature, number>>;
  source: string;
}

export interface ResearchHypothesis {
  id: string;
  question: string;
  hypothesis: string;
  features: MarketFeature[];
  horizon?: string;
  status: "proposed" | "testing" | "validated" | "rejected";
}

export interface BacktestResult {
  hypothesisId: string;
  sampleCount: number;
  trainWindow?: string;
  testWindow?: string;
  metrics: Record<string, number>;
  assumptions: string[];
  warnings: string[];
}

export class QuantResearchPlanner {
  propose(question: string, features: MarketFeature[], horizon?: string): ResearchHypothesis {
    return {
      id: `hypothesis:${Date.now()}`,
      question,
      hypothesis: `Test whether ${features.join(", ")} provide predictive information for the stated question.`,
      features,
      horizon,
      status: "proposed",
    };
  }

  validate(result: BacktestResult): ResearchHypothesis["status"] {
    if (result.sampleCount < 100) return "rejected";
    if (result.warnings.some((warning) => /leakage|look.?ahead/i.test(warning))) return "rejected";
    return "validated";
  }
}
