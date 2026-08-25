export type CreativeSignalSource =
  | "social"
  | "advertising"
  | "commerce"
  | "work"
  | "opportunity"
  | "media"
  | "manual";

export type CreativePerformanceEventType =
  | "impression"
  | "view"
  | "engagement"
  | "click"
  | "lead"
  | "conversion"
  | "purchase"
  | "refund";

export interface CreativeSignal {
  id: string;
  source: CreativeSignalSource;
  contentId?: string;
  platform?: string;
  connectionId?: string;
  accountId?: string;
  campaignId?: string;
  creativeId?: string;
  audienceId?: string;
  hook?: string;
  format?: string;
  topic?: string;
  callToAction?: string;
  confidence?: number;
  observedAt: string;
  metrics: Record<string, number>;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface CreativePerformanceEvent {
  id: string;
  type: CreativePerformanceEventType;
  occurredAt: string;
  source: CreativeSignalSource;
  contentId?: string;
  platform?: string;
  connectionId?: string;
  accountId?: string;
  campaignId?: string;
  creativeId?: string;
  attributionId?: string;
  value?: number;
  currency?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CreativeLearningContext {
  signals: CreativeSignal[];
  events: CreativePerformanceEvent[];
}
