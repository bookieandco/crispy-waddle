import {
  type ArtifactIdentity,
  type BuildProvenance,
  type ProvenanceSnapshot,
  type ProvenanceStatus,
  sha256,
  validateProvenanceGraph,
  validateProductionArtifact,
} from './provenance-assurance.js';

export type VerificationSeverity = 'ERROR' | 'WARNING';

export type ProvenanceVerificationIssue = {
  code: string;
  severity: VerificationSeverity;
  subject: string;
  detail: string;
};

export type ProvenanceVerification = {
  status: ProvenanceStatus;
  verified: boolean;
  issues: readonly ProvenanceVerificationIssue[];
  evidenceHash: string;
};

export type BuildVerificationInput = {
  build: BuildProvenance;
  snapshot: ProvenanceSnapshot;
};

export function verifyArtifactProvenance(
  identity: ArtifactIdentity,
  snapshot: ProvenanceSnapshot,
): ProvenanceVerification {
  const issues: ProvenanceVerificationIssue[] = [];
  const graph = validateProvenanceGraph(snapshot);
  if (!graph.valid) {
    for (const error of graph.errors) {
      issues.push({ code: `GRAPH_${error.split(':', 1)[0]}`, severity: 'ERROR', subject: identity.artifactId, detail: error });
    }
  }

  const artifactStatus = validateProductionArtifact(identity);
  if (artifactStatus !== 'ARTIFACT_VERIFIED') {
    issues.push({ code: 'ARTIFACT_IDENTITY_INVALID', severity: 'ERROR', subject: identity.artifactId, detail: artifactStatus });
  }

  const node = snapshot.nodes.find((candidate) => candidate.id === identity.artifactId);
  if (!node) {
    issues.push({ code: 'ARTIFACT_NODE_MISSING', severity: 'ERROR', subject: identity.artifactId, detail: 'Artifact is not represented in the provenance graph.' });
  } else if (node.hash !== identity.artifactHash) {
    issues.push({ code: 'ARTIFACT_NODE_HASH_MISMATCH', severity: 'ERROR', subject: identity.artifactId, detail: 'Graph artifact hash differs from the bound artifact hash.' });
  }

  const status: ProvenanceStatus = issues.some((issue) => issue.severity === 'ERROR') ? 'CONTRADICTED' : 'ARTIFACT_VERIFIED';
  return {
    status,
    verified: status === 'ARTIFACT_VERIFIED',
    issues,
    evidenceHash: sha256({ status, issues }),
  };
}

export function verifyBuildProvenance(input: BuildVerificationInput): ProvenanceVerification {
  const issues: ProvenanceVerificationIssue[] = [];
  const graph = validateProvenanceGraph(input.snapshot);
  if (!graph.valid) {
    issues.push(...graph.errors.map((error) => ({
      code: `GRAPH_${error.split(':', 1)[0]}`,
      severity: 'ERROR' as const,
      subject: input.build.buildId,
      detail: error,
    })));
  }

  if (input.build.provenanceHash !== sha256({ ...input.build, provenanceHash: undefined })) {
    issues.push({ code: 'BUILD_PROVENANCE_HASH_INVALID', severity: 'ERROR', subject: input.build.buildId, detail: 'Build provenance hash does not match canonical build evidence.' });
  }

  const outputIds = new Set(input.build.outputArtifacts);
  for (const outputId of outputIds) {
    if (!input.snapshot.nodes.some((node) => node.id === outputId && node.type === 'artifact')) {
      issues.push({ code: 'BUILD_OUTPUT_ARTIFACT_MISSING', severity: 'ERROR', subject: outputId, detail: `Build output ${outputId} is not represented as an artifact node.` });
    }
  }

  if (input.build.sourceRefs.length === 0) {
    issues.push({ code: 'BUILD_SOURCE_MISSING', severity: 'ERROR', subject: input.build.buildId, detail: 'Build has no source provenance references.' });
  }

  if (input.build.testResults.length === 0) {
    issues.push({ code: 'BUILD_TEST_EVIDENCE_MISSING', severity: 'WARNING', subject: input.build.buildId, detail: 'Build has no recorded test evidence.' });
  }

  const status: ProvenanceStatus = issues.some((issue) => issue.severity === 'ERROR') ? 'CONTRADICTED' : 'BUILD_VERIFIED';
  return {
    status,
    verified: status === 'BUILD_VERIFIED',
    issues,
    evidenceHash: sha256({ status, issues }),
  };
}
