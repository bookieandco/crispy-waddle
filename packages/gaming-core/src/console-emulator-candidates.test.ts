import {describe,expect,it} from 'vitest';
import {CONSOLE_EMULATOR_CANDIDATES,evaluateConsoleCandidate,type CandidateLaunchEvidence,type ConsoleCandidateId} from './console-emulator-candidates.js';
const source=(id:ConsoleCandidateId)=>CONSOLE_EMULATOR_CANDIDATES.find(x=>x.id===id)!;
const ok=(id:ConsoleCandidateId):CandidateLaunchEvidence=>{
 const c=source(id);
 return{
  candidateId:id,sourceCommit:c.sourceCommit,gamePlatform:c.gamePlatforms[0]!,
  hostPlatform:c.supportedHosts[0]!,verifiedExecutableSha256:'f'.repeat(64),
  artifactProvenanceChecked:true,softwareLicenseReviewed:true,
  gameBytesVerified:true,lawfulGameSource:true,explicitOperatorApproval:true,
  trustedHostReady:true,browserRuntimeAccepted:true,
  verifiedLawfulFirmware:true,reviewedCoreId:'audited-core',
  reviewedCoreSha256:'a'.repeat(64),coreLicenseApproved:true,
  experimentalOptIn:true,graphicsCapabilityVerified:true,
 };
};
const verdict=(e:CandidateLaunchEvidence)=>evaluateConsoleCandidate(e).reason;
describe('GAME-FINISH.14 five upstream emulator source policy',()=>{
 it('includes all five reviewed sources, split into native and web jgenesis paths',()=>{
  expect(CONSOLE_EMULATOR_CANDIDATES).toHaveLength(6);
  expect(new Set(CONSOLE_EMULATOR_CANDIDATES.map(x=>x.repository))).toEqual(new Set([
   'jsgroth/jgenesis','libretro/RetroArch','stenzek/duckstation','snes9xgit/snes9x','KytyPS5/KytyPS5']));
  expect(CONSOLE_EMULATOR_CANDIDATES.every(x=>!x.automaticInstall&&!x.automaticLaunch)).toBe(true);
 });
 it('never promotes PS1/SNES/PS5 engines to browser iPhone runtimes',()=>{
  for(const id of ['duckstation-ps1','snes9x-snes','kytyps5-experimental'] as const)
   expect(verdict({...ok(id),hostPlatform:'web-ios'})).toBe('incompatible-platform');
 });
 it('rejects unpinned source, unverified binary and unreviewed host',()=>{
  expect(verdict({...ok('jgenesis-desktop'),sourceCommit:'0'.repeat(40)})).toBe('unverified-source');
  expect(verdict({...ok('jgenesis-desktop'),verifiedExecutableSha256:'bad'})).toBe('unverified-source');
  expect(verdict({...ok('jgenesis-desktop'),trustedHostReady:false})).toBe('runtime-not-commissioned');
  expect(verdict({...ok('jgenesis-desktop'),explicitOperatorApproval:false})).toBe('operator-approval-required');
  expect(verdict({...ok('jgenesis-desktop'),lawfulGameSource:false})).toBe('unverified-game');
 });
 it('requires separate iPhone WebAssembly attestation for jgenesis web',()=>{
  expect(verdict({...ok('jgenesis-web'),browserRuntimeAccepted:false})).toBe('browser-review-required');
  expect(verdict({...ok('jgenesis-web'),experimentalOptIn:false})).toBe('experimental-opt-in-required');
  expect(verdict(ok('jgenesis-web'))).toBe('admitted-for-reviewed-host-only');
 });
 it('requires the actual RetroArch core rights, pin, binary and approved system',()=>{
  expect(verdict({...ok('retroarch-frontend'),coreLicenseApproved:false})).toBe('libretro-core-review-required');
  expect(verdict({...ok('retroarch-frontend'),reviewedCoreSha256:'bad'})).toBe('libretro-core-review-required');
  expect(verdict(ok('retroarch-frontend'))).toBe('admitted-for-reviewed-host-only');
 });
 it('blocks unlicensed DuckStation commercial use, missing BIOS or altered binary',()=>{
  expect(verdict({...ok('duckstation-ps1'),verifiedLawfulFirmware:false})).toBe('firmware-required');
  expect(verdict({...ok('duckstation-ps1'),commercialDistribution:true})).toBe('commercial-license-restriction');
  expect(verdict({...ok('duckstation-ps1'),alteredOrDerivedBinary:true})).toBe('adaptation-license-restriction');
  expect(verdict({...ok('duckstation-ps1'),commercialDistribution:true,rightsholderCommercialPermission:true})).toBe('admitted-for-reviewed-host-only');
 });
 it('holds Snes9x in commercial context without license approval',()=>{
  expect(verdict({...ok('snes9x-snes'),commercialDistribution:true})).toBe('commercial-license-restriction');
  expect(verdict({...ok('snes9x-snes'),commercialDistribution:true,rightsholderCommercialPermission:true})).toBe('admitted-for-reviewed-host-only');
 });
 it('holds KytyPS5 without experimental opt-in and verified Vulkan GPU',()=>{
  expect(verdict({...ok('kytyps5-experimental'),experimentalOptIn:false})).toBe('experimental-opt-in-required');
  expect(verdict({...ok('kytyps5-experimental'),graphicsCapabilityVerified:false})).toBe('graphics-verification-required');
  expect(verdict(ok('kytyps5-experimental'))).toBe('admitted-for-reviewed-host-only');
 });
});
