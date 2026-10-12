import {
  getSocialCharacterProfileForBrand,
  type SocialAccount,
  type SocialAccountIdentity,
  type SocialIdentityRepository,
  type SocialObservation,
} from "@jhadina/social-core";

export interface IdentityStudioEvidence {
  id: string;
  source: string;
  kind: "performance";
  contentId?: string;
  observedAt: string;
  metrics: Readonly<Record<string, number>>;
  evidenceRefs: readonly string[];
}

export interface IdentityStudioAccount {
  id: string;
  brand: SocialAccount["brand"];
  platform: SocialAccount["platform"];
  provider: string;
  displayName: string;
  handle?: string;
  character: {
    id: string;
    label: string;
    description: string;
    pointOfView: string;
    toneTraits: readonly string[];
    voiceProfileRef: string;
    evidenceRefs: readonly string[];
    status: "governed_registry";
  } | null;
  /** Does NOT imply reviewed identity state or production readiness. */
  identityStatus: "not_configured" | "not_found" | "unverified_snapshot" | "invalid_snapshot";
  identityVersion?: number;
  observedPerformanceCount: number;
  latestObservedAt?: string;
  evidence: readonly IdentityStudioEvidence[];
  observationsAreIdentityLearning: false;
  canReviewIdentityChanges: false;
}

export interface IdentityStudioSnapshot {
  schema: "jhadina.social.identity-studio.v1";
  generatedAt: string;
  authority: "READ_ONLY";
  accounts: readonly IdentityStudioAccount[];
  limitations: readonly string[];
  canPublish: false;
  canApproveIdentity: false;
}

function accountMatchesEvidence(account: SocialAccount, row: SocialObservation): boolean {
  return row.userId === account.userId &&
    row.brand === account.brand &&
    row.accountId === account.id &&
    row.platform === account.platform &&
    row.provider === account.provider &&
    row.providerProfileId === account.providerProfileId;
}

function validIdentitySnapshot(account: SocialAccount, identity: SocialAccountIdentity): boolean {
  const scope = identity.scope;
  return identity.schemaVersion === "jhadina.social.account-identity.v1" &&
    scope.ownerUserId === account.userId && scope.brandId === account.brand &&
    scope.accountId === account.id && scope.platform === account.platform &&
    scope.provider === account.provider && scope.providerProfileId === account.providerProfileId &&
    identity.authority === "EXPRESSION_ONLY" && identity.canPublish === false &&
    identity.canChangeJhadinaPersonality === false &&
    Number.isSafeInteger(identity.version) && identity.version >= 1;
}

/**
 * Builds a truthful owner-scoped, READ-ONLY UI projection. Identity repository
 * access is optional and must be authenticated server-side before injection.
 * Even a valid stored snapshot is NOT proof of a verified owner approval receipt.
 */
export async function buildIdentityStudioSnapshot(input: {
  verifiedUserId: string;
  accounts: readonly SocialAccount[];
  observations: readonly SocialObservation[];
  asOf: string;
  identityRepository?: Pick<SocialIdentityRepository, "load">;
  maxEvidencePerAccount?: number;
}): Promise<IdentityStudioSnapshot> {
  if (!input.verifiedUserId.trim()) throw new Error("SOCIAL_ID_STUDIO_OWNER_REQUIRED");
  if (!Number.isFinite(Date.parse(input.asOf))) throw new Error("SOCIAL_ID_STUDIO_DATE_INVALID");
  const maxEvidence = input.maxEvidencePerAccount ?? 8;
  if (!Number.isInteger(maxEvidence) || maxEvidence < 1 || maxEvidence > 50)
    throw new Error("SOCIAL_ID_STUDIO_EVIDENCE_LIMIT_INVALID");

  const limitations = [
    "Observed performance is not approved identity evolution or evidence of causal growth.",
    "Identity revision approval, rollback and durable learning are not commissioned on this screen.",
  ];
  if (!input.identityRepository) {
    limitations.push("No verified durable account-identity reader is configured.");
  }
  const ownedAccounts = input.accounts.filter(account =>
    account.userId === input.verifiedUserId && account.status === "connected");
  const results = await Promise.all(ownedAccounts.map(async account => {
    const character = getSocialCharacterProfileForBrand(account.brand);
    let identityStatus: IdentityStudioAccount["identityStatus"] =
      input.identityRepository ? "not_found" : "not_configured";
    let identityVersion: number | undefined;
    if (input.identityRepository) {
      try {
        const identity = await input.identityRepository.load({
          ownerUserId: account.userId, brandId: account.brand, accountId: account.id,
          platform: account.platform, provider: account.provider,
          providerProfileId: account.providerProfileId,
        });
        if (identity) {
          if (!validIdentitySnapshot(account, identity)) {
            identityStatus = "invalid_snapshot";
          } else {
            identityStatus = "unverified_snapshot";
            identityVersion = identity.version;
          }
        }
      } catch {
        identityStatus = "invalid_snapshot";
      }
    }
    const rows = input.observations.filter(row =>
      accountMatchesEvidence(account, row) &&
      row.kind === "performance" &&
      row.evidence.length > 0 &&
      Number.isFinite(Date.parse(row.observedAt)) &&
      Date.parse(row.observedAt) <= Date.parse(input.asOf)
    ).sort((a, b) =>
      b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id));
    const evidence = rows.slice(0, maxEvidence).map(row => ({
      id: row.id,
      source: row.source,
      kind: "performance" as const,
      ...(row.contentId ? {contentId: row.contentId} : {}),
      observedAt: row.observedAt,
      metrics: Object.freeze(Object.fromEntries(
        Object.entries(row.metrics ?? {}).filter(([, value]) =>
          typeof value === "number" && Number.isFinite(value) && value >= 0)
      )),
      evidenceRefs: Object.freeze(row.evidence.filter(ref => !!ref.trim()).slice(0, 12)),
    }));
    const result: IdentityStudioAccount = {
      id: account.id, brand: account.brand, platform: account.platform,
      provider: account.provider, displayName: account.displayName,
      ...(account.handle ? {handle: account.handle} : {}),
      character: character ? Object.freeze({
        id: character.id, label: character.label, description: character.description,
        pointOfView: character.pointOfView,
        toneTraits: Object.freeze([...character.toneTraits]),
        voiceProfileRef: character.voiceProfileRef,
        evidenceRefs: Object.freeze([...character.evidenceRefs]),
        status: "governed_registry" as const,
      }) : null,
      identityStatus,
      ...(identityVersion === undefined ? {} : {identityVersion}),
      observedPerformanceCount: rows.length,
      ...(rows[0] ? {latestObservedAt: rows[0].observedAt} : {}),
      evidence: Object.freeze(evidence),
      observationsAreIdentityLearning: false,
      canReviewIdentityChanges: false,
    };
    return Object.freeze(result);
  }));
  if (results.some(account => account.identityStatus === "invalid_snapshot")) {
    limitations.push("One or more stored identity snapshots failed scope validation or were unavailable.");
  }
  if (results.some(account => account.identityStatus === "unverified_snapshot")) {
    limitations.push("Stored identity versions are unverified until owner-approval receipts are checked.");
  }
  if (results.some(account => account.character === null)) {
    limitations.push("Some connected brands lack a governed active character; no persona was inferred.");
  }
  return Object.freeze({
    schema: "jhadina.social.identity-studio.v1" as const,
    generatedAt: input.asOf,
    authority: "READ_ONLY" as const,
    accounts: Object.freeze(results.sort((a, b) =>
      a.brand.localeCompare(b.brand) ||
      a.platform.localeCompare(b.platform) ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id))),
    limitations: Object.freeze(limitations),
    canPublish: false as const,
    canApproveIdentity: false as const,
  });
}
