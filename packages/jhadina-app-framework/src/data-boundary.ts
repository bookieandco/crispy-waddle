export type IntelAccess = "none" | "query-only" | "derived-signals" | "shared-data";

export interface LearningPolicy {
  observeUserInteractions: boolean;
  contributeToPersonalPatterns: boolean;
  createMemoryCandidates: boolean;
}

export interface DataBoundary {
  /** Data owned by the app/customer must not silently become personal Jhadina memory. */
  appDataIsolation: "isolated" | "shared";
  intelAccess: IntelAccess;
  learning: LearningPolicy;
  customerDataToPersonalMemory: false;
}

export interface UserInteractionEvent<T = unknown> {
  eventId: string;
  userId: string;
  appId: string;
  type: string;
  occurredAt: string;
  signal?: T;
  source: "user-interaction";
}

export const DEFAULT_COMMERCIAL_DATA_BOUNDARY: DataBoundary = {
  appDataIsolation: "isolated",
  intelAccess: "none",
  learning: {
    observeUserInteractions: true,
    contributeToPersonalPatterns: true,
    createMemoryCandidates: true,
  },
  customerDataToPersonalMemory: false,
};

export const DEFAULT_PERSONAL_DATA_BOUNDARY: DataBoundary = {
  appDataIsolation: "isolated",
  intelAccess: "query-only",
  learning: {
    observeUserInteractions: true,
    contributeToPersonalPatterns: true,
    createMemoryCandidates: true,
  },
  customerDataToPersonalMemory: false,
};
