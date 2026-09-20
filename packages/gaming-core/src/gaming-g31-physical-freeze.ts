import type {G28CaseEvidence} from './gaming-physical-acceptance.js';
import type {G28DrillEvidence,G28SoakEvidence} from './gaming-physical-drills.js';
import {buildG28ProductionAcceptanceReport,type G28ProductionAcceptanceReport} from './gaming-production-acceptance-report.js';
import {GamingProductionReleaseGate,type GamingReleaseManifest} from './gaming-production-release.js';

export type G31Phase='G31.1'|'G31.2'|'G31.3'|'G31.4'|'G31.5'|'G31.6'|'G31.7'|'G31.8'|'G31.9'|'G31.10'|'G31.11'|'G31.12';

export interface G31EvidenceBundle {
  bundleId:string;
  generatedAtMs:number;
  caseEvidence:readonly G28CaseEvidence[];
  drillEvidence:readonly G28DrillEvidence[];
  soakEvidence?:G28SoakEvidence;
  artifactRefs:readonly string[];
}

export interface G31FreezeReceipt {
  status:'frozen'|'evidence-required'|'blocked';
  bundleId:string;
  g28:G28ProductionAcceptanceReport;
  releaseReasons:readonly string[];
  immutableEvidenceRefs:readonly string[];
}

export class G31PhysicalProductionFreeze {
  constructor(private readonly releaseGate=new GamingProductionReleaseGate()){}

  evaluate(bundle:G31EvidenceBundle,manifest:Omit<GamingReleaseManifest,'physicalAcceptance'>):G31FreezeReceipt{
    if(!bundle.bundleId.trim())throw new Error('G31 evidence bundle identity is required');
    const g28=buildG28ProductionAcceptanceReport({
      caseEvidence:bundle.caseEvidence,
      drillEvidence:bundle.drillEvidence,
      soakEvidence:bundle.soakEvidence,
      generatedAtMs:bundle.generatedAtMs,
    });
    const release=this.releaseGate.evaluate({...manifest,physicalAcceptance:g28});
    return{
      status:release.status,
      bundleId:bundle.bundleId,
      g28,
      releaseReasons:[...release.reasons],
      immutableEvidenceRefs:[...bundle.artifactRefs],
    };
  }
}

export const G31_PHASES:readonly G31Phase[]=Object.freeze([
 'G31.1','G31.2','G31.3','G31.4','G31.5','G31.6','G31.7','G31.8','G31.9','G31.10','G31.11','G31.12',
]);

export const G31_PHYSICAL_SCOPE=Object.freeze({
 controllers:['gamesir-x5-lite','dualsense-usb','dualsense-bluetooth'],
 emulation:['libretro-wasm','emulatorjs-browser','native-emulator'],
 displays:['homebase-tv'],
 pcStreaming:['sunshine-lan','sunshine-internet'],
 playstation:['dualsense-ps5','gamesir-x5-ps5','playstation-lan','playstation-internet'],
 xbox:['xbox-home','xbox-cloud'],
 destructiveDrills:15,
 minimumSoakMinutes:240,
 minimumSoakCycles:20,
});
