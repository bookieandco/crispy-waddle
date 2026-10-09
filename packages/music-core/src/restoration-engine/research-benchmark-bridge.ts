/** RESTORE-UNIFY.4 — read-only research fixture bridge.
 * Never grants production execution, model admission, source rights or Drive upload.
 * Actual source audio must enter the existing owner-authenticated ingest path and
 * be independently hashed; research metadata is not an authorized audio URL.
 */
export interface ResearchBenchmarkFixture {
  fixtureId: string;
  title: string;
  source: {
    repository: "bookieandco/music-restoration-intelligence";
    commit: string;
    path: string;
    gitBlobSha1: string;
    sizeBytes: number;
    sha256: string | null;
  };
  rightsStatus: "review_required";
  benchmarkStatus: "defined_not_executed";
  humanReviewRequired: true;
}

export interface ResearchBenchmarkBridge {
  schemaVersion: "music-restoration-research-bridge/v1";
  canonicalRuntimeRepository: "bookieandco/crispy-waddle";
  researchRepository: "bookieandco/music-restoration-intelligence";
  executionAuthority: "none";
  productionDeploymentAuthorized: false;
  driveUploadAuthorized: false;
  referenceSources: ResearchBenchmarkFixture[];
}

export interface ReadOnlyResearchCandidate {
  fixture: ResearchBenchmarkFixture;
  requiresOwnerIngest: true;
  requiresRightsReview: true;
  productionAuthorized: false;
}

const GIT_SHA_1 = /^[a-f0-9]{40}$/;
const SHA_256 = /^[a-f0-9]{64}$/;
const safeFile = /^[^/\\.\x00-\x1f][^/\\\x00-\x1f]{0,199}\.(mp3|wav|flac)$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MUSIC_RESEARCH_BRIDGE_INVALID_OBJECT");
  }
  return value as Record<string, unknown>;
}

/** Validate a research suggestion only, without trusting its origin or capabilities. */
export function readResearchBenchmarkCandidates(input: unknown): {
  candidates: ReadOnlyResearchCandidate[];
  productionAuthorized: false;
} {
  const data = record(input);
  if (data.schemaVersion !== "music-restoration-research-bridge/v1" ||
      data.canonicalRuntimeRepository !== "bookieandco/crispy-waddle" ||
      data.researchRepository !== "bookieandco/music-restoration-intelligence" ||
      data.executionAuthority !== "none" ||
      data.productionDeploymentAuthorized !== false ||
      data.driveUploadAuthorized !== false) {
    throw new Error("MUSIC_RESEARCH_BRIDGE_CANNOT_GRANT_RUNTIME_OR_DRIVE");
  }
  const fixtures = data.referenceSources;
  if (!Array.isArray(fixtures) || fixtures.length < 1 || fixtures.length > 30) {
    throw new Error("MUSIC_RESEARCH_BRIDGE_FIXTURE_COUNT_INVALID");
  }
  const seen = new Set<string>();
  const candidates = fixtures.map((value): ReadOnlyResearchCandidate => {
    const fixture = record(value);
    const source = record(fixture.source);
    const id = fixture.fixtureId;
    if (typeof id !== "string" || !/^MUSIC-RESTORE\.AB-[0-9]{3,5}$/.test(id) ||
        seen.has(id) || typeof fixture.title !== "string" || !fixture.title.trim() ||
        fixture.title.length > 200 ||
        source.repository !== "bookieandco/music-restoration-intelligence" ||
        typeof source.commit !== "string" || !GIT_SHA_1.test(source.commit) ||
        typeof source.gitBlobSha1 !== "string" || !GIT_SHA_1.test(source.gitBlobSha1) ||
        typeof source.path !== "string" || !safeFile.test(source.path) ||
        typeof source.sizeBytes !== "number" || !Number.isSafeInteger(source.sizeBytes) ||
        source.sizeBytes < 1 || source.sizeBytes > 512 * 1024 * 1024 ||
        (source.sha256 !== null && (typeof source.sha256 !== "string" || !SHA_256.test(source.sha256))) ||
        fixture.rightsStatus !== "review_required" ||
        fixture.benchmarkStatus !== "defined_not_executed" ||
        fixture.humanReviewRequired !== true) {
      throw new Error("MUSIC_RESEARCH_BRIDGE_SOURCE_OR_RIGHTS_INVALID");
    }
    seen.add(id);
    return {
      fixture: {
        fixtureId: id, title: fixture.title as string,
        source: {
          repository: "bookieandco/music-restoration-intelligence",
          commit: source.commit as string, path: source.path as string,
          gitBlobSha1: source.gitBlobSha1 as string,
          sizeBytes: source.sizeBytes as number,
          sha256: source.sha256 as string | null,
        },
        rightsStatus: "review_required", benchmarkStatus: "defined_not_executed",
        humanReviewRequired: true,
      },
      requiresOwnerIngest: true, requiresRightsReview: true,
      productionAuthorized: false,
    };
  });
  return { candidates, productionAuthorized: false };
}
