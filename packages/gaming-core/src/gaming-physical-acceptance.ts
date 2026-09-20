import type {CommissioningPathId,CommissioningReceipt} from './gaming-commissioning.js';

export interface G28AcceptanceCase {
  id:string;
  phase:'G28.2'|'G28.3'|'G28.4'|'G28.5'|'G28.6'|'G28.7'|'G28.8';
  pathId:CommissioningPathId;
  requirements:readonly string[];
  minimumSamples:number;
}

export const G28_ACCEPTANCE_MATRIX:readonly G28AcceptanceCase[]=Object.freeze([
 {id:'x5-local',phase:'G28.2',pathId:'gamesir-x5-local',requirements:['usb-c','generic-gamepad-fallback','exact-once-input','save','reconnect'],minimumSamples:20},
 {id:'x5-ps5',phase:'G28.2',pathId:'gamesir-x5-ps5',requirements:['usb-c','generic-gamepad-fallback','ps5-remote-play','exact-once-input','reconnect'],minimumSamples:20},
 {id:'dualsense-usb',phase:'G28.3',pathId:'dualsense-usb-local',requirements:['full-dualsense','usb','exact-once-input'],minimumSamples:20},
 {id:'dualsense-bt',phase:'G28.3',pathId:'dualsense-bluetooth-local',requirements:['full-dualsense','bluetooth','reconnect'],minimumSamples:20},
 {id:'dualsense-ps5',phase:'G28.3',pathId:'dualsense-ps5',requirements:['full-dualsense','adaptive-trigger-capability','haptics-capability','gyro-capability','touchpad-capability','ps5-remote-play'],minimumSamples:20},
 {id:'libretro',phase:'G28.4',pathId:'libretro-wasm',requirements:['launch','controller','save','restore','teardown'],minimumSamples:20},
 {id:'browser',phase:'G28.4',pathId:'emulatorjs-browser',requirements:['self-hosted-assets','gamepad','indexeddb-save','offline','teardown'],minimumSamples:20},
 {id:'native-emulator',phase:'G28.4',pathId:'native-emulator',requirements:['provenance','launch','controller','save','teardown'],minimumSamples:20},
 {id:'homebase-tv',phase:'G28.5',pathId:'homebase-tv',requirements:['direct-route','controller-independent-video','display-switch','teardown'],minimumSamples:20},
 {id:'sunshine-lan',phase:'G28.6',pathId:'sunshine-lan',requirements:['pairing','lan','input-first-degrade','reconnect','teardown'],minimumSamples:20},
 {id:'sunshine-internet',phase:'G28.6',pathId:'sunshine-internet',requirements:['remote-network','latency-policy','input-first-degrade','reconnect','teardown'],minimumSamples:20},
 {id:'ps5-lan',phase:'G28.7',pathId:'playstation-lan',requirements:['wake','pairing','launch','network-degrade','reconnect','teardown'],minimumSamples:20},
 {id:'ps5-internet',phase:'G28.7',pathId:'playstation-internet',requirements:['pairing','remote-network','latency-policy','reconnect','teardown'],minimumSamples:20},
 {id:'xbox-home',phase:'G28.8',pathId:'xbox-home',requirements:['account-vault','home-stream','controller','reconnect','teardown'],minimumSamples:20},
 {id:'xbox-cloud',phase:'G28.8',pathId:'xbox-cloud',requirements:['account-vault','cloud-stream','controller','reconnect','teardown'],minimumSamples:20},
]);

export interface G28CaseEvidence {caseId:string;receipt:CommissioningReceipt;passedRequirements:readonly string[];}

export function evaluateG28Case(testCase:G28AcceptanceCase,evidence:G28CaseEvidence){
 if(evidence.caseId!==testCase.id||evidence.receipt.pathId!==testCase.pathId)throw new Error('G28 evidence does not match acceptance case');
 const passed=new Set(evidence.passedRequirements);
 const missing=testCase.requirements.filter(x=>!passed.has(x));
 const enoughSamples=evidence.receipt.samples.length>=testCase.minimumSamples;
 const zeroOrphans=evidence.receipt.samples.every(x=>x.orphanedResources===0);
 return{passed:evidence.receipt.observedByHardware&&enoughSamples&&zeroOrphans&&missing.length===0,hardwareObserved:evidence.receipt.observedByHardware,enoughSamples,zeroOrphans,missingRequirements:missing};
}
