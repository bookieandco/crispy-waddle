export type EmulatorSourceKind=
  |'curated-list'
  |'browser-catalog'
  |'browser-runtime'
  |'portable-bundle'
  |'frontend-reference'
  |'libretro-wasm'
  |'native-runtime'
  |'embedded-runtime';

export type EmulatorSourceTrust='discovery-only'|'candidate'|'runtime-framework';

export interface EmulatorSourceReference {
  id:string;
  repository:string;
  kind:EmulatorSourceKind;
  trust:EmulatorSourceTrust;
  summary:string;
  capabilities:readonly string[];
  neverAutomatic:readonly string[];
}

export const EMULATOR_SOURCE_REFERENCES:readonly EmulatorSourceReference[]=Object.freeze([
  {
    id:'awesome-emulators',
    repository:'alnacle/awesome-emulators',
    kind:'curated-list',
    trust:'discovery-only',
    summary:'Curated open-source emulator discovery source spanning many console families.',
    capabilities:['candidate-discovery','platform-taxonomy'],
    neverAutomatic:['install','download-binary','launch'],
  },
  {
    id:'jsemu',
    repository:'fcambus/jsemu',
    kind:'browser-catalog',
    trust:'discovery-only',
    summary:'Catalog of JavaScript and browser-oriented emulator projects.',
    capabilities:['browser-candidate-discovery','javascript-runtime-discovery'],
    neverAutomatic:['install','download-binary','launch'],
  },
  {
    id:'emulatorjs',
    repository:'EmulatorJS/EmulatorJS',
    kind:'browser-runtime',
    trust:'runtime-framework',
    summary:'Self-hosted JavaScript emulation framework for legacy systems.',
    capabilities:['browser-runtime','web-controller-input','core-selection'],
    neverAutomatic:['rom-download','bios-download','unreviewed-core-install'],
  },
  {
    id:'portable-retro-games',
    repository:'aciderix/portable-retro-games',
    kind:'portable-bundle',
    trust:'candidate',
    summary:'Offline standalone HTML packaging model for user-provided retro game content.',
    capabilities:['offline-html-package','browser-runtime','touch-input'],
    neverAutomatic:['rom-download','content-bundling-without-user-source'],
  },
  {
    id:'emuze',
    repository:'bmsuseluda/emuze',
    kind:'frontend-reference',
    trust:'candidate',
    summary:'Emulation frontend reference for emulator configuration, metadata, BIOS handling and gamepad setup.',
    capabilities:['frontend-orchestration','gamepad-configuration','metadata-import','bios-handling-reference'],
    neverAutomatic:['bundle-third-party-emulators','firmware-download','rom-download'],
  },
  {
    id:'retroemu',
    repository:'monteslu/retroemu',
    kind:'libretro-wasm',
    trust:'runtime-framework',
    summary:'Libretro cores compiled to WebAssembly with controller, audio and save-state support.',
    capabilities:['libretro','wasm','controller-input','save-state','battery-save','multi-system'],
    neverAutomatic:['rom-download','bios-download','unpinned-core-build'],
  },
  {
    id:'game-box',
    repository:'QQxiaoming/game_box',
    kind:'native-runtime',
    trust:'candidate',
    summary:'Qt-based native and embedded retro emulator reference.',
    capabilities:['qt','native-runtime','embedded-linux'],
    neverAutomatic:['install','rom-download'],
  },
  {
    id:'retro-go',
    repository:'ducalex/retro-go',
    kind:'embedded-runtime',
    trust:'candidate',
    summary:'ESP32 retro-gaming firmware/runtime reference with launcher and save-state features.',
    capabilities:['esp32','embedded-runtime','save-state','launcher','cover-art'],
    neverAutomatic:['flash-device','firmware-download','rom-download'],
  },
]);

export interface EmulatorCandidateAudit {
  sourceId:string;
  provenanceVerified:boolean;
  licenseReviewed:boolean;
  maintenanceReviewed:boolean;
  inputReviewed:boolean;
  saveReviewed:boolean;
  firmwareRequirementsReviewed:boolean;
  securityReviewed:boolean;
  explicitUserApproval:boolean;
}

export interface EmulatorPromotionDecision {
  allowed:boolean;
  reason:
    |'approved'
    |'unknown-source'
    |'discovery-source-only'
    |'audit-incomplete'
    |'explicit-approval-required';
}

export class EmulatorSourceRegistry {
  private readonly byId=new Map(EMULATOR_SOURCE_REFERENCES.map(source=>[source.id,source]));

  get(id:string):EmulatorSourceReference|undefined{return this.byId.get(id);}
  list(kind?:EmulatorSourceKind):readonly EmulatorSourceReference[]{
    return EMULATOR_SOURCE_REFERENCES.filter(source=>!kind||source.kind===kind);
  }

  promote(audit:EmulatorCandidateAudit):EmulatorPromotionDecision{
    const source=this.byId.get(audit.sourceId);
    if(!source)return{allowed:false,reason:'unknown-source'};
    if(source.trust==='discovery-only')return{allowed:false,reason:'discovery-source-only'};
    const complete=
      audit.provenanceVerified&&
      audit.licenseReviewed&&
      audit.maintenanceReviewed&&
      audit.inputReviewed&&
      audit.saveReviewed&&
      audit.firmwareRequirementsReviewed&&
      audit.securityReviewed;
    if(!complete)return{allowed:false,reason:'audit-incomplete'};
    if(!audit.explicitUserApproval)return{allowed:false,reason:'explicit-approval-required'};
    return{allowed:true,reason:'approved'};
  }
}
