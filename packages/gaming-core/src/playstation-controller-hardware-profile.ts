import type {ControllerCapability} from './controller-capabilities.js';

export type PlayStationControllerFeature=
  |'buttons'
  |'axes'
  |'dpad'
  |'digital-triggers'
  |'analog-triggers'
  |'standard-rumble'
  |'advanced-haptics'
  |'adaptive-triggers'
  |'gyro'
  |'touchpad'
  |'usb-wired'
  |'bluetooth'
  |'phone-attached';

export interface PlayStationControllerHardwareProfile {
  id:string;
  displayName:string;
  transport:'usb-c'|'bluetooth'|'phone-usb-c';
  g13Capabilities:readonly ControllerCapability[];
  features:readonly PlayStationControllerFeature[];
  triggerMode:'digital'|'analog'|'adaptive';
}

export const DUALSENSE_HARDWARE_PROFILE:PlayStationControllerHardwareProfile=Object.freeze({
  id:'dualsense',
  displayName:'Sony DualSense',
  transport:'bluetooth',
  g13Capabilities:['buttons','axes','triggers','dpad','haptics'],
  features:[
    'buttons','axes','dpad','analog-triggers','advanced-haptics',
    'adaptive-triggers','gyro','touchpad','usb-wired','bluetooth',
  ],
  triggerMode:'adaptive',
});

export const GAMESIR_X5_LITE_HARDWARE_PROFILE:PlayStationControllerHardwareProfile=Object.freeze({
  id:'gamesir-x5-lite',
  displayName:'GameSir X5 Lite',
  transport:'phone-usb-c',
  g13Capabilities:['buttons','axes','triggers','dpad'],
  features:['buttons','axes','dpad','digital-triggers','usb-wired','phone-attached'],
  triggerMode:'digital',
});

export const PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX=Object.freeze([
  {
    profile:DUALSENSE_HARDWARE_PROFILE,
    path:['dualsense','jhadina','ps5'] as const,
  },
  {
    profile:GAMESIR_X5_LITE_HARDWARE_PROFILE,
    path:['gamesir-x5-lite','phone','jhadina','ps5'] as const,
  },
]);

export interface PlayStationControllerRequirement {
  required:readonly PlayStationControllerFeature[];
  optional:readonly PlayStationControllerFeature[];
}

export interface PlayStationControllerNegotiation {
  allowed:boolean;
  missingRequired:readonly PlayStationControllerFeature[];
  enabledOptional:readonly PlayStationControllerFeature[];
  unavailableOptional:readonly PlayStationControllerFeature[];
  fallbackMode:'full-dualsense'|'generic-gamepad'|'blocked';
}

export function negotiatePlayStationController(
  profile:PlayStationControllerHardwareProfile,
  requirement:PlayStationControllerRequirement,
):PlayStationControllerNegotiation{
  const available=new Set(profile.features);
  const missingRequired=requirement.required.filter(feature=>!available.has(feature));
  const enabledOptional=requirement.optional.filter(feature=>available.has(feature));
  const unavailableOptional=requirement.optional.filter(feature=>!available.has(feature));
  if(missingRequired.length>0){
    return{allowed:false,missingRequired,enabledOptional,unavailableOptional,fallbackMode:'blocked'};
  }
  const fullDualSense=
    available.has('advanced-haptics')&&
    available.has('adaptive-triggers')&&
    available.has('gyro')&&
    available.has('touchpad');
  return{
    allowed:true,
    missingRequired:[],
    enabledOptional,
    unavailableOptional,
    fallbackMode:fullDualSense?'full-dualsense':'generic-gamepad',
  };
}

export const DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT:PlayStationControllerRequirement=Object.freeze({
  required:['buttons','axes','dpad'],
  optional:['analog-triggers','advanced-haptics','adaptive-triggers','gyro','touchpad'],
});
