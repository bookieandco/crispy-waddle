export type Observation = {
  id: string;
  assetId: string;
  kind: string;
  time: { startSeconds: number; endSeconds: number };
  payload: unknown;
  confidence: number;
  provenance: { provider: string; source: string; [key: string]: unknown };
};

export type StudyRecord = {
  studyId: string;
  startedAt: string;
  completedAt?: string;
  observations: Observation[];
  decisions: unknown[];
  predictions: unknown[];
};

/** In-process observation/event ledger used by Director study runtimes. */
export class ObservationBus {
  private readonly studies = new Map<string, StudyRecord>();

  startStudy(studyId: string, startedAt = new Date().toISOString()): StudyRecord {
    const existing = this.studies.get(studyId);
    if (existing) return structuredClone(existing);
    const record: StudyRecord = { studyId, startedAt, observations: [], decisions: [], predictions: [] };
    this.studies.set(studyId, record);
    return structuredClone(record);
  }

  recordObservation(studyId: string, observation: Observation): void {
    const study = this.studies.get(studyId) ?? this.startStudy(studyId);
    study.observations.push(structuredClone(observation));
    this.studies.set(studyId, study);
  }

  recordDecision(studyId: string, decision: unknown): void {
    const study = this.studies.get(studyId) ?? this.startStudy(studyId);
    study.decisions.push(structuredClone(decision));
    this.studies.set(studyId, study);
  }

  recordPrediction(studyId: string, prediction: unknown): void {
    const study = this.studies.get(studyId) ?? this.startStudy(studyId);
    study.predictions.push(structuredClone(prediction));
    this.studies.set(studyId, study);
  }

  completeStudy(studyId: string, completedAt = new Date().toISOString()): StudyRecord {
    const study = this.studies.get(studyId) ?? this.startStudy(studyId);
    study.completedAt = completedAt;
    this.studies.set(studyId, study);
    return structuredClone(study);
  }

  getStudy(studyId: string): StudyRecord | undefined {
    const study = this.studies.get(studyId);
    return study ? structuredClone(study) : undefined;
  }
}
