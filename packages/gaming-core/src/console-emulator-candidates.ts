import type {GamePlatform} from './runtime.js';

/**
 * Audited candidate registry, NOT a download/install/launch adapter.
 * A verified native host and explicit software/content rights are required
 * before a separate reviewed adapter may be commissioned.
 */
export type ConsoleCandidateId=
  'jgenesis-desktop'|'jgenesis-web'|'retroarch-frontend'|
  'duckstation-ps1'|'snes9x-snes'|'kytyps5-experimental';
export type HostPlatform='windows'|'linux'|'macos'|'web-ios'|'web-desktop';
export type LicensePolicy='gpl-3.0'|'gpl-2.0'|'core-dependent'|'noncommercial-no-derivatives'|'noncommercial';
export interface ConsoleCandidate {
  id:ConsoleCandidateId;
  repository:string;
  sourceCommit:string;
  licensePolicy:LicensePolicy;
  supportedHosts:readonly HostPlatform[];
  gamePlatforms:readonly GamePlatform[];
  requiredFirmware:'none'|'required'|'game-dependent';
  requiresReviewedLibretroCore:boolean;
  experimental:boolean;
  automaticInstall:false;
  automaticLaunch:false;
  summary:string;
}
function defineCandidate(candidate:ConsoleCandidate):ConsoleCandidate{return Object.freeze(candidate);}
export const CONSOLE_EMULATOR_CANDIDATES:readonly ConsoleCandidate[]=Object.freeze([
  defineCandidate({
    id:'jgenesis-desktop',repository:'jsgroth/jgenesis',
    sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
    licensePolicy:'gpl-3.0',supportedHosts:['windows','linux'],
    gamePlatforms:['gameboy','gba','nes','snes','genesis'],
    requiredFirmware:'game-dependent',requiresReviewedLibretroCore:false,
    experimental:false,automaticInstall:false,automaticLaunch:false,
    summary:'Desktop multi-system emulator. Sega CD/32X and Game Gear are upstream capabilities; Jhadina game platform taxonomy needs expansion before admitting them.',
  }),
  defineCandidate({
    id:'jgenesis-web',repository:'jsgroth/jgenesis',
    sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
    licensePolicy:'gpl-3.0',supportedHosts:['web-ios','web-desktop'],
    gamePlatforms:['gameboy','gba','nes','snes','genesis'],
    requiredFirmware:'game-dependent',requiresReviewedLibretroCore:false,
    experimental:true,automaticInstall:false,automaticLaunch:false,
    summary:'Upstream reports a WebAssembly build; iPhone Safari assets, memory limits, touch mapping and user-save adapter are not commissioned.',
  }),
  defineCandidate({
    id:'retroarch-frontend',repository:'libretro/RetroArch',
    sourceCommit:'cdc286f851d4f04264b7ef88ca63d8c357409fd5',
    licensePolicy:'core-dependent',supportedHosts:['windows','linux','macos'],
    gamePlatforms:['gameboy','gba','nes','snes','genesis','ps1'],
    requiredFirmware:'game-dependent',requiresReviewedLibretroCore:true,
    experimental:false,automaticInstall:false,automaticLaunch:false,
    summary:'GPLv3 frontend and per-core Libretro emulation. Each chosen core has independent license, capability, firmware and binary attestation gates.',
  }),
  defineCandidate({
    id:'duckstation-ps1',repository:'stenzek/duckstation',
    sourceCommit:'cd024df237d46faa4c65574b101261b31267e2fd',
    licensePolicy:'noncommercial-no-derivatives',supportedHosts:['windows','linux','macos'],
    gamePlatforms:['ps1'],requiredFirmware:'required',requiresReviewedLibretroCore:false,
    experimental:false,automaticInstall:false,automaticLaunch:false,
    summary:'PlayStation 1 desktop emulator. Current CC BY-NC-ND license restricts commercial distribution and adaptations; lawful owner-supplied PS1/PS2 BIOS is required.',
  }),
  defineCandidate({
    id:'snes9x-snes',repository:'snes9xgit/snes9x',
    sourceCommit:'1bcc369e89f08243e0a462882fb1f3e42e51de3a',
    licensePolicy:'noncommercial',supportedHosts:['windows','linux','macos'],
    gamePlatforms:['snes'],requiredFirmware:'game-dependent',requiresReviewedLibretroCore:false,
    experimental:false,automaticInstall:false,automaticLaunch:false,
    summary:'SNES native or Libretro candidate. Upstream custom license grants personal/noncommercial use, not general commercial integration.',
  }),
  defineCandidate({
    id:'kytyps5-experimental',repository:'KytyPS5/KytyPS5',
    sourceCommit:'730e1a3cf39d50c787d477e813e0bef92006a063',
    licensePolicy:'gpl-2.0',supportedHosts:['windows','linux','macos'],
    gamePlatforms:['ps5'],requiredFirmware:'game-dependent',requiresReviewedLibretroCore:false,
    experimental:true,automaticInstall:false,automaticLaunch:false,
    summary:'Experimental PS5 translation layer; Windows/Linux priority, macOS experimental, host Vulkan 1.3. No Jhadina runtime/compatibility or physical hardware certification.',
  }),
]);
export interface CandidateLaunchEvidence {
  candidateId:ConsoleCandidateId;
  sourceCommit:string;
  gamePlatform:GamePlatform;
  hostPlatform:HostPlatform;
  /** SHA-256 of executable/WASM artifact attested by the host, not browser input. */
  verifiedExecutableSha256:string;
  artifactProvenanceChecked:boolean;
  softwareLicenseReviewed:boolean;
  gameBytesVerified:boolean;
  lawfulGameSource:boolean;
  explicitOperatorApproval:boolean;
  /** The native host must implement confined argv without a shell. */
  trustedHostReady:boolean;
  /** iPhone/browser builds require separate review of actual WASM/JS and controls. */
  browserRuntimeAccepted?:boolean;
  /** Firmware must be owner-supplied, byte-verified and lawful when required. */
  verifiedLawfulFirmware?:boolean;
  /** Each RetroArch core must be pinned and reviewed independently. */
  reviewedCoreId?:string;
  reviewedCoreSha256?:string;
  coreLicenseApproved?:boolean;
  /** Commercial Jhadina integrations need an additional actual rights grant. */
  commercialDistribution?:boolean;
  rightsholderCommercialPermission?:boolean;
  /** DuckStation CC BY-NC-ND cannot be silently modified or redistributed. */
  alteredOrDerivedBinary?:boolean;
  separateAdaptationPermission?:boolean;
  /** Explicit separate approval for experimental runtimes, not mere discovery. */
  experimentalOptIn?:boolean;
  graphicsCapabilityVerified?:boolean;
}
export type CandidateAdmissionReason =
 'unknown-candidate'|'incompatible-platform'|'unverified-source'|
 'runtime-not-commissioned'|'unverified-game'|'operator-approval-required'|
 'browser-review-required'|'firmware-required'|'libretro-core-review-required'|
 'commercial-license-restriction'|'adaptation-license-restriction'|
 'experimental-opt-in-required'|'graphics-verification-required'|'admitted-for-reviewed-host-only';

const HEX64=/^[0-9a-f]{64}$/i;
export function evaluateConsoleCandidate(e:CandidateLaunchEvidence):{
  allowed:boolean;reason:CandidateAdmissionReason;candidate?:ConsoleCandidate
}{
 const candidate=CONSOLE_EMULATOR_CANDIDATES.find(c=>c.id===e.candidateId);
 if(!candidate)return{allowed:false,reason:'unknown-candidate'};
 const deny=(reason:CandidateAdmissionReason)=>({allowed:false,reason,candidate});
 if(!candidate.gamePlatforms.includes(e.gamePlatform)||!candidate.supportedHosts.includes(e.hostPlatform))return deny('incompatible-platform');
 if(e.sourceCommit!==candidate.sourceCommit||!HEX64.test(e.verifiedExecutableSha256)||!e.artifactProvenanceChecked)return deny('unverified-source');
 if(!e.softwareLicenseReviewed||!e.trustedHostReady)return deny('runtime-not-commissioned');
 if(!e.gameBytesVerified||!e.lawfulGameSource)return deny('unverified-game');
 if(!e.explicitOperatorApproval)return deny('operator-approval-required');
 if(e.hostPlatform.startsWith('web-')&&!e.browserRuntimeAccepted)return deny('browser-review-required');
 if(candidate.requiredFirmware==='required'&&!e.verifiedLawfulFirmware)return deny('firmware-required');
 if(candidate.requiresReviewedLibretroCore&&
    (!e.reviewedCoreId?.trim()||!HEX64.test(e.reviewedCoreSha256??'')||!e.coreLicenseApproved))
   return deny('libretro-core-review-required');
 if(e.commercialDistribution&&['noncommercial','noncommercial-no-derivatives'].includes(candidate.licensePolicy)
    &&!e.rightsholderCommercialPermission)return deny('commercial-license-restriction');
 if(candidate.licensePolicy==='noncommercial-no-derivatives'&&e.alteredOrDerivedBinary&&!e.separateAdaptationPermission)
   return deny('adaptation-license-restriction');
 if(candidate.experimental&&!e.experimentalOptIn)return deny('experimental-opt-in-required');
 if(candidate.id==='kytyps5-experimental'&&!e.graphicsCapabilityVerified)return deny('graphics-verification-required');
 return{allowed:true,reason:'admitted-for-reviewed-host-only',candidate};
}
