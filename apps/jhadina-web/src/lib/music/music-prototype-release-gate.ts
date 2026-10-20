/** Release admission requires actual runtime, device, privacy and recovery evidence.
 * CI passing alone MUST NOT transition a prototype to owner-certified/live.
 */
export type MusicPrototypeReleaseEvidence={
  exactHeadCiPassed:boolean;
  isolatedRestoreSucceeded:boolean;
  storageObjectRecoveryVerified:boolean;
  dawMigrationInstalled:boolean;
  ownerOnlyAuthNegativeTestPassed:boolean;
  privateDeployVerified:boolean;
  actualOwnedWavUploadedAndShaVerified:boolean;
  physicalIphonePlaybackPassed:boolean;
  physicalIphoneEditSaveReopenPassed:boolean;
  independentDryWavExportVerified:boolean;
  googleDriveArchiveReadbackVerified:boolean;
};
export const MUSIC_PROTOTYPE_RELEASE_GATE_FIELDS=[
  "exactHeadCiPassed","isolatedRestoreSucceeded","storageObjectRecoveryVerified",
  "dawMigrationInstalled","ownerOnlyAuthNegativeTestPassed","privateDeployVerified",
  "actualOwnedWavUploadedAndShaVerified","physicalIphonePlaybackPassed",
  "physicalIphoneEditSaveReopenPassed","independentDryWavExportVerified",
  "googleDriveArchiveReadbackVerified",
] as const;
export function evaluateMusicPrototypeRelease(
  evidence:Partial<MusicPrototypeReleaseEvidence>,
) {
  const missing=MUSIC_PROTOTYPE_RELEASE_GATE_FIELDS.filter(key=>evidence[key]!==true);
  return {releaseApprovedByEvidence:missing.length===0,missing};
}
