export type GamingFailureKind=
  |'controller-disconnect'|'bluetooth-drop'|'wifi-loss'|'host-restart'|'browser-refresh'
  |'runtime-crash'|'display-disconnect'|'save-conflict'|'corrupted-save'|'storage-full'
  |'homebase-sleep'|'console-standby'|'duplicate-input'|'stale-input'|'crash-during-save-flush';

export interface GamingRecoveryPlan {
  failure:GamingFailureKind;
  replayInput:false;
  actions:readonly string[];
  requiresUserDecision:boolean;
}

const PLANS:Readonly<Record<GamingFailureKind,GamingRecoveryPlan>>={
  'controller-disconnect':{failure:'controller-disconnect',replayInput:false,actions:['revoke-input','preserve-sequence-floor','rebind-controller'],requiresUserDecision:false},
  'bluetooth-drop':{failure:'bluetooth-drop',replayInput:false,actions:['revoke-input','preserve-sequence-floor','reconnect-transport'],requiresUserDecision:false},
  'wifi-loss':{failure:'wifi-loss',replayInput:false,actions:['degrade-session','stop-new-input','reconnect-network'],requiresUserDecision:false},
  'host-restart':{failure:'host-restart',replayInput:false,actions:['mark-runtime-lost','reload-last-safe-save','new-runtime-session'],requiresUserDecision:false},
  'browser-refresh':{failure:'browser-refresh',replayInput:false,actions:['restore-indexeddb-save','new-runtime-session'],requiresUserDecision:false},
  'runtime-crash':{failure:'runtime-crash',replayInput:false,actions:['terminalize-runtime','preserve-last-safe-save','offer-restart'],requiresUserDecision:true},
  'display-disconnect':{failure:'display-disconnect',replayInput:false,actions:['pause-if-supported','reroute-display'],requiresUserDecision:false},
  'save-conflict':{failure:'save-conflict',replayInput:false,actions:['preserve-both-revisions','request-save-choice'],requiresUserDecision:true},
  'corrupted-save':{failure:'corrupted-save',replayInput:false,actions:['quarantine-save','restore-last-verified-revision'],requiresUserDecision:true},
  'storage-full':{failure:'storage-full',replayInput:false,actions:['stop-new-save-writes','preserve-runtime','request-storage-action'],requiresUserDecision:true},
  'homebase-sleep':{failure:'homebase-sleep',replayInput:false,actions:['mark-runtime-suspended','wake-homebase','reconnect-runtime'],requiresUserDecision:false},
  'console-standby':{failure:'console-standby',replayInput:false,actions:['mark-runtime-suspended','supported-wake','reconnect-runtime'],requiresUserDecision:false},
  'duplicate-input':{failure:'duplicate-input',replayInput:false,actions:['drop-input','record-integrity-event'],requiresUserDecision:false},
  'stale-input':{failure:'stale-input',replayInput:false,actions:['drop-input','record-integrity-event'],requiresUserDecision:false},
  'crash-during-save-flush':{failure:'crash-during-save-flush',replayInput:false,actions:['mark-save-unverified','preserve-previous-revision','quarantine-partial-write'],requiresUserDecision:true},
};

export class GamingRecoveryPolicy {
  plan(failure:GamingFailureKind):GamingRecoveryPlan{return PLANS[failure];}
  drillMatrix():readonly GamingRecoveryPlan[]{return Object.values(PLANS);}
}
