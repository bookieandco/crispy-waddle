import { describe, expect, it } from "vitest";
import { blockedMusicReleaseGate, evaluateMusicReleaseGate } from "./music-release-gate";
const sha = "a".repeat(40);
describe("Music launch admission", () => {
  it("reports all missing real proofs; source-level green CI is not deployment-ready", () => {
    const e = blockedMusicReleaseGate(sha);
    e.githubWorkflowPasses = true;
    const result = evaluateMusicReleaseGate(e);
    expect(result.admitted).toBe(false);
    expect(result.sourceOnly).toBe(true);
    expect(result.blocked).toContain("writable_database_and_restore");
    expect(result.blocked).toContain("two_user_write_denials");
    expect(result.blocked).toContain("native_iphone_background_audio");
  });
  it("will not admit a missing commit or absent operator release decision", () => {
    const e = blockedMusicReleaseGate("not-a-commit");
    Object.assign(e, {
      githubWorkflowPasses:true, writableDatabaseAndBackupRestoreProved:true,
      reviewedCatalogAndStorageRlsApplied:true, twoUserReadIsolationProved:true,
      twoUserWriteDenialsProved:true, privateUploadAndContentHashProved:true,
      licensedPlayableSourceProved:true, signedUrlExpiryAndRenewalProved:true,
      nativeIphoneBackgroundAudioProved:true,
    });
    expect(evaluateMusicReleaseGate(e).blocked).toEqual([
      "github_exact_head_ci","operator_release_approval",
    ]);
  });
});
