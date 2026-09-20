export type GamingAcceptanceMode='local'|'lan'|'internet'|'offline';

export interface GamingDeviceAcceptanceCase {
  id:string;
  devices:readonly string[];
  modes:readonly GamingAcceptanceMode[];
  requirements:readonly string[];
}

export const G26_DEVICE_ACCEPTANCE_MATRIX:readonly GamingDeviceAcceptanceCase[]=Object.freeze([
  {id:'phone-local',devices:['jhadina-phone','generic-hid'],modes:['local','offline'],requirements:['launch','input','save','resume','teardown']},
  {id:'iphone-x5',devices:['iphone-usb-c','gamesir-x5-lite'],modes:['local','lan','internet'],requirements:['generic-gamepad-fallback','exact-once-input','latency-measurement','reconnect']},
  {id:'dualsense-usb',devices:['dualsense-usb'],modes:['local','lan'],requirements:['full-dualsense-profile','exact-once-input','latency-measurement']},
  {id:'dualsense-bluetooth',devices:['dualsense-bluetooth'],modes:['local','lan'],requirements:['full-dualsense-profile','reconnect','latency-measurement']},
  {id:'homebase-tv',devices:['homebase','tv'],modes:['local','lan'],requirements:['direct-display-preference','save','teardown']},
  {id:'browser',devices:['browser','generic-hid'],modes:['local','offline'],requirements:['self-hosted-assets','indexeddb-save','gamepad']},
  {id:'pc-sunshine',devices:['pc','sunshine','moonlight'],modes:['lan','internet'],requirements:['pairing','input-first-latency','reconnect','teardown']},
  {id:'ps5-dualsense',devices:['ps5','dualsense'],modes:['lan','internet'],requirements:['pairing','full-dualsense-profile','remote-play','reconnect','teardown']},
  {id:'ps5-x5',devices:['ps5','iphone-usb-c','gamesir-x5-lite'],modes:['lan','internet'],requirements:['pairing','generic-gamepad-fallback','remote-play','reconnect','teardown']},
  {id:'xbox-streaming',devices:['xbox','generic-hid'],modes:['lan','internet'],requirements:['account-vault','home-or-cloud-stream','reconnect','teardown']},
]);

export interface GamingDeviceAcceptanceEvidence {
  caseId:string;
  hardwareObserved:boolean;
  requirementsPassed:readonly string[];
  artifactRefs:readonly string[];
}

export interface GamingDeviceAcceptanceResult {
  passed:boolean;
  missingRequirements:readonly string[];
  hardwareEvidenceMissing:boolean;
}

export function evaluateDeviceAcceptance(
  testCase:GamingDeviceAcceptanceCase,
  evidence:GamingDeviceAcceptanceEvidence,
):GamingDeviceAcceptanceResult{
  if(evidence.caseId!==testCase.id)throw new Error('Device acceptance evidence does not match case');
  const passed=new Set(evidence.requirementsPassed);
  const missing=testCase.requirements.filter(requirement=>!passed.has(requirement));
  return{passed:evidence.hardwareObserved&&missing.length===0,missingRequirements:missing,hardwareEvidenceMissing:!evidence.hardwareObserved};
}
