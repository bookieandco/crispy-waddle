export type ControllerCapability='buttons'|'axes'|'triggers'|'dpad'|'haptics';

export interface ControllerCapabilityProfile {
  deviceId:string;
  capabilities:readonly ControllerCapability[];
}

export interface ControllerCapabilityRequirement {
  required:readonly ControllerCapability[];
}

export function assertControllerCapabilities(profile:ControllerCapabilityProfile,requirement:ControllerCapabilityRequirement):void{
  if(typeof profile.deviceId!=='string'||!profile.deviceId.trim())throw new Error('deviceId is required');
  const available=new Set(profile.capabilities);
  for(const capability of requirement.required){
    if(!available.has(capability))throw new Error(`Controller capability required: ${capability}`);
  }
}

export function controllerSupports(profile:ControllerCapabilityProfile,capability:ControllerCapability):boolean{
  return profile.capabilities.includes(capability);
}

export interface ControllerInputCapabilityRequirement {
  buttons?:boolean;
  axes?:boolean;
  triggers?:boolean;
  dpad?:boolean;
  haptics?:boolean;
}

export function requiredCapabilitiesForInput(requirement:ControllerInputCapabilityRequirement):ControllerCapability[] {
  const capabilities:ControllerCapability[]=[];
  if(requirement.buttons)capabilities.push('buttons');
  if(requirement.axes)capabilities.push('axes');
  if(requirement.triggers)capabilities.push('triggers');
  if(requirement.dpad)capabilities.push('dpad');
  if(requirement.haptics)capabilities.push('haptics');
  return capabilities;
}
