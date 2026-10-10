/**
 * Release admission flags are evidence claims supplied by independent live
 * verification, never inferred from repository tests or a dashboard status.
 */
export interface MusicReleaseEvidence {
  exactGitCommit: string;
  githubWorkflowPasses: boolean;
  writableDatabaseAndBackupRestoreProved: boolean;
  reviewedCatalogAndStorageRlsApplied: boolean;
  twoUserReadIsolationProved: boolean;
  twoUserWriteDenialsProved: boolean;
  privateUploadAndContentHashProved: boolean;
  licensedPlayableSourceProved: boolean;
  signedUrlExpiryAndRenewalProved: boolean;
  nativeIphoneBackgroundAudioProved: boolean;
  explicitOperatorApproval: boolean;
}
export interface MusicReleaseGateResult {
  admitted: boolean;
  blocked: string[];
  sourceOnly: boolean;
}
const FULL_SHA = /^[a-f0-9]{40}$/i;
export function evaluateMusicReleaseGate(input: MusicReleaseEvidence): MusicReleaseGateResult {
  const blocked: string[] = [];
  if (!FULL_SHA.test(input.exactGitCommit) || !input.githubWorkflowPasses) blocked.push("github_exact_head_ci");
  const checks: Array<[keyof MusicReleaseEvidence, string]> = [
    ["writableDatabaseAndBackupRestoreProved","writable_database_and_restore"],
    ["reviewedCatalogAndStorageRlsApplied","reviewed_rls_and_storage_policy"],
    ["twoUserReadIsolationProved","two_user_read_isolation"],
    ["twoUserWriteDenialsProved","two_user_write_denials"],
    ["privateUploadAndContentHashProved","owned_file_hash_and_private_upload"],
    ["licensedPlayableSourceProved","real_licensed_playback"],
    ["signedUrlExpiryAndRenewalProved","signed_audio_expiry_and_renewal"],
    ["nativeIphoneBackgroundAudioProved","native_iphone_background_audio"],
    ["explicitOperatorApproval","operator_release_approval"],
  ];
  for (const [key, label] of checks) if (input[key] !== true) blocked.push(label);
  return { admitted: blocked.length === 0, blocked, sourceOnly: blocked.length > 0 };
}
export function blockedMusicReleaseGate(commitSha: string): MusicReleaseEvidence {
  return {
    exactGitCommit: commitSha,
    githubWorkflowPasses: false,
    writableDatabaseAndBackupRestoreProved: false,
    reviewedCatalogAndStorageRlsApplied: false,
    twoUserReadIsolationProved: false,
    twoUserWriteDenialsProved: false,
    privateUploadAndContentHashProved: false,
    licensedPlayableSourceProved: false,
    signedUrlExpiryAndRenewalProved: false,
    nativeIphoneBackgroundAudioProved: false,
    explicitOperatorApproval: false,
  };
}
