import {createHash} from 'node:crypto';

/**
 * SHARK-HISTORY-SALVAGE.06: Normalize independently retrieved Drive metadata.
 * Metadata alone is NOT proof of an original ledger, a remote archive, a
 * complete Drive-wide search, or a backed-up PostgreSQL database.
 * No Google account tokens, network calls, or upload logic lives here.
 */
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const SHADOW_DRIVE_FOLDERS=Object.freeze({
  ledger:'1yph-JtoOSyonkdWLRoqq5DKoBn-9T9FX',
  market:'1TLZNs6EnLZqsMhP0s-TdHMkQw7hWsoMF',
  memory:'1mMUHdKXmtio2v4oRUfyKbWYRq-F-6dQ6',
  health:'1Ev30yeh3D03Sa_itxfT5BHLk40jJAKWO',
  handoff:'13EJZYM_IsDBJXKTWZVjYLAPZfmWTZv6m',
});
export type ShadowDriveFolder=keyof typeof SHADOW_DRIVE_FOLDERS;
export type ShadowDriveItem=Readonly<{
  id:string;name:string;mimeType:string;sizeBytes?:number;
}>;
export type ShadowDriveFolderResult=Readonly<{
  folder:ShadowDriveFolder;folderId:string;items:readonly ShadowDriveItem[];
  // Null signals explicit EOF, not a partial response.
  nextPageToken:string|null;
  fetchedWithAuthenticatedConnection:boolean;
  enumerationSucceeded:boolean;
}>;
export type ShadowDriveScan=Readonly<{
  scanId:string;
  asOf:string;
  folders:readonly ShadowDriveFolderResult[];
}>;
export type ShadowDriveInventoryReceipt=Readonly<{
  schema:'shark.history.drive-metadata.v1';
  scanId:string;
  inventoryHash:string;
  state:'SCOPED_METADATA_COMPLETE'|'INCOMPLETE';
  reasonCodes:readonly string[];
  folderCounts:Readonly<Record<ShadowDriveFolder,number>>;
  metadataCandidates:readonly Readonly<{
    sourceFolder:ShadowDriveFolder;id:string;
    admission:'METADATA_ONLY_NEEDS_BYTES'|'SYNTHETIC_EXCLUDED'|'DOCUMENT_EXCLUDED';
  }>[];
  originalLedgerRecovered:false;
  postgresArchiveVerified:false;
  machineOAuthVerified:false;
  canUpdateForwardLearning:false;
  canExecute:false;
  canAuthorizeLive:false;
}>;

const required=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<512;
const folderNames=['ledger','market','memory','health','handoff'] as const;
const labels=(item:ShadowDriveItem):'METADATA_ONLY_NEEDS_BYTES'|'SYNTHETIC_EXCLUDED'|'DOCUMENT_EXCLUDED'=>{
  if(/canary|synthetic|fixture|test[-_]?only/i.test(item.name))return 'SYNTHETIC_EXCLUDED';
  if(item.mimeType.startsWith('application/vnd.google-apps.')||
     /\.md$|\.txt$|handoff|build.plan|audit/i.test(item.name))return 'DOCUMENT_EXCLUDED';
  return 'METADATA_ONLY_NEEDS_BYTES';
};
export function assessShadowDriveInventory(input:ShadowDriveScan):ShadowDriveInventoryReceipt{
  if(!required(input.scanId)||!Number.isFinite(Date.parse(input.asOf))||
     input.folders.length!==folderNames.length)
    throw Error('SHARK_DRIVE_SCAN_INPUT_INVALID');
  const reasons:string[]=[];
  const seen=new Set<ShadowDriveFolder>();
  const itemsSeen=new Map<string,string>();
  const counts:Record<ShadowDriveFolder,number>={ledger:0,market:0,memory:0,health:0,handoff:0};
  const candidates:Array<{sourceFolder:ShadowDriveFolder;id:string;admission:ReturnType<typeof labels>}>=[];
  for(const folder of input.folders){
    if(!folderNames.includes(folder.folder)||seen.has(folder.folder)||
       folder.folderId!==SHADOW_DRIVE_FOLDERS[folder.folder]||
       !Array.isArray(folder.items)||folder.items.length>10000)
       throw Error('SHARK_DRIVE_FOLDER_SCOPE_INVALID');
    seen.add(folder.folder);
    if(!folder.enumerationSucceeded||!folder.fetchedWithAuthenticatedConnection||
       folder.nextPageToken!==null)
      reasons.push('INCOMPLETE_FOLDER_'+folder.folder.toUpperCase());
    for(const item of folder.items){
      if(!required(item.id)||!required(item.name)||!required(item.mimeType)||
         (item.sizeBytes!==undefined&&(!Number.isSafeInteger(item.sizeBytes)||item.sizeBytes<0)))
        throw Error('SHARK_DRIVE_ITEM_INVALID');
      const itemIdentity=sha({name:item.name,mimeType:item.mimeType,sizeBytes:item.sizeBytes??null});
      const prior=itemsSeen.get(item.id);
      if(prior&&prior!==itemIdentity)throw Error('SHARK_DRIVE_DUPLICATE_FILE_CONFLICT');
      // A Drive file in two folders is a single object, not two backups.
      if(prior){reasons.push('DUPLICATE_ITEM_ACROSS_FOLDERS');continue;}
      itemsSeen.set(item.id,itemIdentity);
      counts[folder.folder]+=1;
      candidates.push({sourceFolder:folder.folder,id:item.id,admission:labels(item)});
    }
  }
  const sorted=candidates.sort((a,b)=>a.sourceFolder.localeCompare(b.sourceFolder)||a.id.localeCompare(b.id));
  const frozenCounts=Object.freeze({...counts});
  return Object.freeze({
    schema:'shark.history.drive-metadata.v1' as const,scanId:input.scanId,
    inventoryHash:sha({counts:frozenCounts,items:sorted}),
    state:reasons.length?'INCOMPLETE' as const:'SCOPED_METADATA_COMPLETE' as const,
    reasonCodes:Object.freeze([...new Set(reasons)].sort()),folderCounts:frozenCounts,
    metadataCandidates:Object.freeze(sorted.map(x=>Object.freeze(x))),
    originalLedgerRecovered:false as const,postgresArchiveVerified:false as const,
    machineOAuthVerified:false as const,canUpdateForwardLearning:false as const,
    canExecute:false as const,canAuthorizeLive:false as const,
  });
}
