export type MusicArtifactKind = "source" | "derived" | "reconstructed" | "synthetic" | "external";

export interface MusicArtifact {
  id: string;
  kind: MusicArtifactKind;
  contentHash: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  parentArtifactId?: string;
  createdAt: string;
}

export interface RestorationVersion {
  id: string;
  caseId: string;
  sourceArtifactId: string;
  outputArtifactId: string;
  candidateId?: string;
  operationClass: "analysis" | "correction" | "reconstruction" | "source-recovery" | "production" | "simulation";
  operation: string;
  evidenceIds: string[];
  authorizationIds: string[];
  qcPassed: boolean;
  createdAt: string;
}

export interface ProvenanceLedgerEntry {
  id: string;
  type: "artifact-registered" | "version-created" | "execution-completed" | "execution-failed" | "execution-aborted";
  artifactId?: string;
  versionId?: string;
  sourceArtifactId?: string;
  executionId?: string;
  receiptId?: string;
  contentHash?: string;
  createdAt: string;
}

const unique = (values: string[]): string[] => [...new Set(values)];

export class RestorationProvenanceLedger {
  private readonly artifacts = new Map<string, MusicArtifact>();
  private readonly versions = new Map<string, RestorationVersion>();
  private readonly entries: ProvenanceLedgerEntry[] = [];

  registerArtifact(artifact: MusicArtifact): MusicArtifact {
    if (this.artifacts.has(artifact.id)) throw new Error(`Artifact already registered: ${artifact.id}`);
    if (!artifact.contentHash) throw new Error("Artifact content hash is required.");
    if (artifact.sampleRate <= 0 || artifact.channels <= 0 || artifact.sampleCount < 0) {
      throw new Error("Artifact signal dimensions must be valid.");
    }
    if (artifact.parentArtifactId && !this.artifacts.has(artifact.parentArtifactId)) {
      throw new Error("Parent artifact must be registered before a derived artifact.");
    }
    const normalized = { ...artifact };
    this.artifacts.set(normalized.id, normalized);
    this.entries.push({
      id: `ledger:artifact:${artifact.id}`,
      type: "artifact-registered",
      artifactId: artifact.id,
      contentHash: artifact.contentHash,
      createdAt: artifact.createdAt,
    });
    return normalized;
  }

  createVersion(version: RestorationVersion): RestorationVersion {
    if (this.versions.has(version.id)) throw new Error(`Restoration version already exists: ${version.id}`);
    const source = this.artifacts.get(version.sourceArtifactId);
    const output = this.artifacts.get(version.outputArtifactId);
    if (!source || !output) throw new Error("Source and output artifacts must be registered.");
    if (output.parentArtifactId !== source.id) {
      throw new Error("Output artifact must declare the version source as its parent.");
    }
    if (version.operationClass !== "analysis" && !version.qcPassed) {
      throw new Error("Non-analysis restoration versions require passed QC.");
    }
    const normalized: RestorationVersion = {
      ...version,
      evidenceIds: unique(version.evidenceIds),
      authorizationIds: unique(version.authorizationIds),
    };
    this.versions.set(normalized.id, normalized);
    this.entries.push({
      id: `ledger:version:${version.id}`,
      type: "version-created",
      versionId: version.id,
      sourceArtifactId: version.sourceArtifactId,
      artifactId: version.outputArtifactId,
      contentHash: output.contentHash,
      createdAt: version.createdAt,
    });
    return normalized;
  }

  recordExecutionAudit(entry: ProvenanceLedgerEntry): ProvenanceLedgerEntry {
    if (!["execution-completed", "execution-failed", "execution-aborted"].includes(entry.type)) {
      throw new Error("Only execution audit events may be appended here.");
    }
    if (!entry.executionId || !entry.receiptId || !entry.sourceArtifactId) {
      throw new Error("Execution audit requires execution, receipt, and source artifact identifiers.");
    }
    if (this.entries.some((existing) => existing.id === entry.id)) {
      throw new Error(`Ledger entry already exists: ${entry.id}`);
    }
    const normalized = { ...entry };
    this.entries.push(normalized);
    return normalized;
  }

  getArtifact(id: string): MusicArtifact | undefined { return this.artifacts.get(id); }
  getVersion(id: string): RestorationVersion | undefined { return this.versions.get(id); }
  getEntries(): readonly ProvenanceLedgerEntry[] { return [...this.entries]; }
}
