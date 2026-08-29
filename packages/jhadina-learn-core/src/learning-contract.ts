export type LearningSourceType = "text" | "file" | "video" | "url";

export type LearningKind =
  | "fact"
  | "preference"
  | "rule"
  | "procedure"
  | "concept"
  | "definition"
  | "pattern"
  | "instruction";

export type LearningScope =
  | "global"
  | "workspace"
  | "domain"
  | "project"
  | "temporary";

export type LearningStatus =
  | "proposed"
  | "active"
  | "superseded"
  | "revoked";

export interface LearningSource {
  type: LearningSourceType;
  value: string;
  title?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface LearnRequest {
  instruction?: string;
  sources: LearningSource[];
  requestedScope?: LearningScope;
  requestedApplication?: string[];
  sourceConversationId?: string;
  sourceMessageId?: string;
}

export interface LearningRecord {
  id: string;
  kind: LearningKind;
  subject: string;
  content: unknown;
  authority: "user";
  scope: LearningScope;
  status: LearningStatus;
  confidence: number;
  sources: LearningSource[];
  appliesTo: string[];
  supersedes?: string[];
  conflictsWith?: string[];
  createdAt: string;
  updatedAt: string;
}

export type LearningEventType =
  | "LEARNING_REQUESTED"
  | "LEARNING_ACCEPTED"
  | "LEARNING_APPLIED"
  | "LEARNING_SUPERSEDED"
  | "LEARNING_REVOKED";

export interface LearningEvent {
  type: LearningEventType;
  learningId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface LearningRepository {
  save(record: LearningRecord): Promise<LearningRecord>;
  get(id: string): Promise<LearningRecord | null>;
  listActive(scope?: LearningScope): Promise<LearningRecord[]>;
  revoke(id: string, at?: string): Promise<LearningRecord>;
}
