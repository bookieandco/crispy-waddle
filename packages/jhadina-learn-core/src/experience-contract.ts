export type ExperienceReaction = "like" | "dislike" | "mixed" | "curious" | "neutral";

export interface ExperienceObservation {
  id: string;
  category: string;
  observation: string;
  significance?: number;
  evidence?: string[];
}

export interface ExperienceReflection {
  summary: string;
  reactions: ExperienceReaction[];
  observations: ExperienceObservation[];
  patterns: string[];
  questions: string[];
  adoptedSignals: string[];
  rejectedSignals: string[];
  unresolvedSignals: string[];
}

export interface ExperienceRecord {
  id: string;
  sourceLearningId: string;
  sourceTypes: Array<"text" | "file" | "video" | "url">;
  title?: string;
  instruction?: string;
  content: unknown;
  reflection?: ExperienceReflection;
  status: "experienced" | "reflected" | "promoted" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceReflector {
  reflect(input: {
    instruction?: string;
    sources: ExperienceRecord["sourceTypes"];
    content: unknown;
  }): Promise<ExperienceReflection>;
}

export interface ExperienceRepository {
  save(record: ExperienceRecord): Promise<ExperienceRecord>;
  get(id: string): Promise<ExperienceRecord | null>;
  listByLearningId(learningId: string): Promise<ExperienceRecord[]>;
}
