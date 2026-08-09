export type LandingPageKind = "lead_capture" | "sales" | "product" | "webinar" | "thank_you" | "affiliate";
export type FunnelStage = "awareness" | "interest" | "lead" | "offer" | "purchase" | "retention";

export interface LandingPageSpec {
  id: string;
  name: string;
  kind: LandingPageKind;
  headline: string;
  subheadline?: string;
  audience: string;
  offer?: string;
  primaryCta: string;
  formFields?: string[];
  brandId?: string;
  customDomain?: string;
  analytics?: { provider: string; measurementId?: string }[];
  status: "draft" | "review" | "published" | "archived";
}

export interface FunnelSpec {
  id: string;
  name: string;
  stages: FunnelStage[];
  landingPageIds: string[];
  campaignId?: string;
  conversionGoal: string;
  approvalRequiredForPublish: boolean;
}

export interface FunnelEvent {
  id: string;
  funnelId: string;
  stage: FunnelStage;
  event: "view" | "cta" | "form_start" | "lead" | "offer_view" | "purchase";
  occurredAt: string;
  anonymousSessionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface FunnelOptimizationSuggestion {
  funnelId: string;
  hypothesis: string;
  metric: string;
  recommendedChange: string;
  confidence?: number;
  requiresApproval: boolean;
}

export interface LandingPageAdapter {
  readonly id: string;
  create(spec: LandingPageSpec): Promise<{ externalId: string; url?: string }>;
  update(externalId: string, spec: LandingPageSpec): Promise<void>;
  publish(externalId: string): Promise<void>;
}

export function validateLandingPageSpec(spec: LandingPageSpec): string[] {
  const issues: string[] = [];
  if (!spec.id) issues.push("id is required");
  if (!spec.name) issues.push("name is required");
  if (!spec.headline) issues.push("headline is required");
  if (!spec.audience) issues.push("audience is required");
  if (!spec.primaryCta) issues.push("primaryCta is required");
  return issues;
}
