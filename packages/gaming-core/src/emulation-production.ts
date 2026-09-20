import type {CanonicalButton} from './controller.js';
import type {ManagedGamingSave} from './gaming-save-sync.js';

export interface BrowserAssetInventory {
  version:string;
  dataPath:string;
  loaderPresent:boolean;
  stylesheetPresent:boolean;
  coreIds:readonly string[];
  cdnFallbackDisabled:boolean;
}

export class BrowserAssetProvisioner {
  certify(inventory:BrowserAssetInventory,requiredCoreIds:readonly string[]):void{
    if(!inventory.version.trim())throw new Error('Browser emulator version is required');
    if(!inventory.dataPath.startsWith('/'))throw new Error('Browser emulator assets must use an app-local data path');
    if(!inventory.loaderPresent||!inventory.stylesheetPresent)throw new Error('Browser emulator host assets are incomplete');
    if(!inventory.cdnFallbackDisabled)throw new Error('Browser emulator CDN fallback must remain disabled');
    const installed=new Set(inventory.coreIds);
    for(const id of requiredCoreIds)if(!installed.has(id))throw new Error(`Browser emulator core not provisioned: ${id}`);
  }
}

export interface PortableGamePackageInput {
  gameId:string;
  contentHash:string;
  contentSource:'user-provided';
  runtimeId:string;
  runtimeVersion:string;
  coreId:string;
  offlineAssets:readonly string[];
  biosHashes?:readonly string[];
}

export interface PortableGamePackageManifest extends PortableGamePackageInput {
  format:'jhadina-portable-game-v1';
  packageId:string;
}

export function buildPortableGamePackage(input:PortableGamePackageInput):PortableGamePackageManifest{
  for(const [label,value] of [['gameId',input.gameId],['contentHash',input.contentHash],['runtimeId',input.runtimeId],['runtimeVersion',input.runtimeVersion],['coreId',input.coreId]] as const){
    if(!value.trim())throw new Error(`${label} is required`);
  }
  if(input.offlineAssets.length===0)throw new Error('Portable game package requires offline runtime assets');
  const packageId=`portable:${input.gameId}:${input.contentHash.slice(0,16)}:${input.runtimeVersion}`;
  return{...input,format:'jhadina-portable-game-v1',packageId};
}

export type EmulatorSaveKind='battery'|'state'|'browser-indexeddb'|'native-file';

export interface EmulatorSaveArtifact {
  gameId:string;
  ownerId:string;
  runtimeId:string;
  kind:EmulatorSaveKind;
  contentHash:string;
  revision:number;
  updatedAtMs:number;
  payloadUri:string;
}

export class UniversalEmulatorSaveBridge {
  normalize(save:EmulatorSaveArtifact):ManagedGamingSave{
    if(!Number.isInteger(save.revision)||save.revision<1)throw new Error('Save revision must be a positive integer');
    if(!Number.isFinite(save.updatedAtMs))throw new Error('Save timestamp must be finite');
    return{
      saveId:`emu:${save.ownerId}:${save.gameId}:${save.kind}`,
      gameId:save.gameId,
      ownerId:save.ownerId,
      runtimeId:save.runtimeId,
      kind:save.kind==='state'||save.kind==='browser-indexeddb'?'state':'persistent',
      uri:save.payloadUri,
      revision:save.revision,
      updatedAtMs:save.updatedAtMs,
    };
  }

  resolveConflict(left:EmulatorSaveArtifact,right:EmulatorSaveArtifact):EmulatorSaveArtifact{
    if(left.gameId!==right.gameId||left.ownerId!==right.ownerId||left.kind!==right.kind)throw new Error('Cannot resolve saves with different ownership or kind');
    if(left.revision!==right.revision)return left.revision>right.revision?left:right;
    if(left.updatedAtMs!==right.updatedAtMs)return left.updatedAtMs>right.updatedAtMs?left:right;
    if(left.contentHash===right.contentHash)return left;
    throw new Error('Save conflict requires user resolution');
  }
}

export type EmulatorInputControl='up'|'down'|'left'|'right'|'a'|'b'|'x'|'y'|'l'|'r'|'l2'|'r2'|'start'|'select'|'home';

export interface EmulatorControllerMapping {
  profileId:string;
  controls:Readonly<Partial<Record<CanonicalButton,EmulatorInputControl>>>;
  hotkeys:Readonly<Record<string,string>>;
}

export const DEFAULT_EMULATOR_CONTROLLER_MAPPING:EmulatorControllerMapping=Object.freeze({
  profileId:'jhadina-standard-gamepad',
  controls:{
    a:'a',b:'b',x:'x',y:'y',l1:'l',r1:'r',l2:'l2',r2:'r2',
    dpad_up:'up',dpad_down:'down',dpad_left:'left',dpad_right:'right',
    start:'start',select:'select',home:'home',
  } as const,
  hotkeys:{
    'save-state':'meta+save',
    'load-state':'meta+load',
    'exit':'meta+exit',
  } as const,
});

export function assertGameplayHotkeysSeparated(mapping:EmulatorControllerMapping):void{
  const gameplay=new Set(Object.keys(mapping.controls));
  for(const hotkey of Object.values(mapping.hotkeys)){
    if(gameplay.has(hotkey))throw new Error('Emulator hotkey collides with gameplay input');
  }
}

export interface EmulatorPerformanceCandidate {
  runtimeId:string;
  compatible:boolean;
  measured:boolean;
  frameTimeMs:number;
  audioLatencyMs:number;
  inputLatencyMs:number;
  thermalCost:number;
  batteryCost:number;
  location:'phone'|'homebase'|'desktop'|'browser';
}

export interface EmulatorPerformancePolicy {
  maxFrameTimeMs:number;
  maxAudioLatencyMs:number;
  maxInputLatencyMs:number;
  preferHomebaseWhenThermalCostAtLeast:number;
}

export function selectEmulatorPerformanceCandidate(
  candidates:readonly EmulatorPerformanceCandidate[],
  policy:EmulatorPerformancePolicy,
):EmulatorPerformanceCandidate{
  const viable=candidates.filter(candidate=>
    candidate.compatible&&candidate.measured&&
    candidate.frameTimeMs<=policy.maxFrameTimeMs&&
    candidate.audioLatencyMs<=policy.maxAudioLatencyMs&&
    candidate.inputLatencyMs<=policy.maxInputLatencyMs
  );
  if(viable.length===0)throw new Error('No measured compatible emulator runtime satisfies performance policy');
  return [...viable].sort((a,b)=>{
    const aThermal=a.location==='phone'&&a.thermalCost>=policy.preferHomebaseWhenThermalCostAtLeast?1000:0;
    const bThermal=b.location==='phone'&&b.thermalCost>=policy.preferHomebaseWhenThermalCostAtLeast?1000:0;
    return (aThermal+a.inputLatencyMs+a.frameTimeMs+a.audioLatencyMs+a.batteryCost)-
      (bThermal+b.inputLatencyMs+b.frameTimeMs+b.audioLatencyMs+b.batteryCost)||
      a.runtimeId.localeCompare(b.runtimeId);
  })[0]!;
}

export interface ImportedGameContent {
  title:string;
  platform:string;
  region?:string;
  version?:string;
  byteLength:number;
  contentDigest:string;
  source:'user-selected';
}

export interface CanonicalGameContentIdentity extends ImportedGameContent {
  canonicalId:string;
  duplicateKey:string;
}

export class GameContentIdentityService {
  identify(input:ImportedGameContent):CanonicalGameContentIdentity{
    if(input.source!=='user-selected')throw new Error('Game import must originate from a user-selected source');
    if(!input.title.trim()||!input.platform.trim()||!input.contentDigest.trim())throw new Error('Game identity metadata is incomplete');
    if(!Number.isInteger(input.byteLength)||input.byteLength<0)throw new Error('byteLength must be a non-negative integer');
    const normalizedDigest=input.contentDigest.toLowerCase();
    return{
      ...input,
      contentDigest:normalizedDigest,
      canonicalId:`game:${input.platform.toLowerCase()}:${normalizedDigest.slice(0,24)}`,
      duplicateKey:`${normalizedDigest}:${input.byteLength}`,
    };
  }

  deduplicate(items:readonly CanonicalGameContentIdentity[]):readonly CanonicalGameContentIdentity[]{
    const seen=new Set<string>();
    return items.filter(item=>{
      if(seen.has(item.duplicateKey))return false;
      seen.add(item.duplicateKey);
      return true;
    });
  }
}

export interface EmulationAcceptanceCase {
  id:string;
  system:string;
  runtime:'libretro-wasm'|'emulatorjs-browser'|'portable-offline';
  biosRequired:boolean;
  controllerRequired:boolean;
  mustRestoreSave:boolean;
}

export const UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX:readonly EmulationAcceptanceCase[]=Object.freeze([
  {id:'nes-browser',system:'nes',runtime:'emulatorjs-browser',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'snes-wasm',system:'snes',runtime:'libretro-wasm',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'gb-wasm',system:'gameboy',runtime:'libretro-wasm',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'gba-browser',system:'gba',runtime:'emulatorjs-browser',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'genesis-wasm',system:'genesis',runtime:'libretro-wasm',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'n64-browser',system:'n64',runtime:'emulatorjs-browser',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'ps1-wasm',system:'playstation',runtime:'libretro-wasm',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
  {id:'pcecd-bios',system:'pc-engine-cd',runtime:'libretro-wasm',biosRequired:true,controllerRequired:true,mustRestoreSave:true},
  {id:'offline-portable',system:'nes',runtime:'portable-offline',biosRequired:false,controllerRequired:true,mustRestoreSave:true},
]);
