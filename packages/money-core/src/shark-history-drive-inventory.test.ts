import test from 'node:test';
import assert from 'node:assert/strict';
import {SHADOW_DRIVE_FOLDERS,assessShadowDriveInventory,
  type ShadowDriveScan,type ShadowDriveItem} from './shark-history-drive-inventory.js';
const at='2026-10-08T21:00:00Z';
const folders=Object.entries(SHADOW_DRIVE_FOLDERS).map(([folder,folderId])=>({
 folder:folder as keyof typeof SHADOW_DRIVE_FOLDERS,folderId,
 items:[] as readonly ShadowDriveItem[],nextPageToken:null,
 fetchedWithAuthenticatedConnection:true,enumerationSucceeded:true,
}));
const scan=(fs=folders):ShadowDriveScan=>({scanId:'drive-audit-1',asOf:at,folders:fs});
const item=(id:string,name:string,mimeType='application/vnd.google-apps.document'):
 ShadowDriveItem=>({id,name,mimeType});
const populated=()=>{
 const copy=folders.map(x=>({...x,items:[...x.items]}));
 copy[3]!.items=[
   item('a','SHADOW-GDRIVE-CANARY-SYNTHETIC','application/vnd.google-apps.document'),
   item('b','SHADOW-GDRIVE-RAW-BYTES-CANARY.txt','text/plain'),
 ];
 copy[4]!.items=[item('c','SHADOW recovery handoff'),item('d','SHARK build plan'),
                   item('e','SHARK Historical Drive Inventory')];
 return copy;
};
test('scoped Drive metadata matches actual known empty snapshot/replay/memory folders',()=>{
 const r=assessShadowDriveInventory(scan(populated()));
 assert.equal(r.state,'SCOPED_METADATA_COMPLETE');
 assert.deepEqual(r.folderCounts,{ledger:0,market:0,memory:0,health:2,handoff:3});
 assert.equal(r.originalLedgerRecovered,false);
 assert.equal(r.postgresArchiveVerified,false);
 assert.equal(r.machineOAuthVerified,false);
 assert.equal(r.canUpdateForwardLearning,false);
 assert.equal(r.canExecute,false);
 assert.equal(r.metadataCandidates.filter(x=>x.admission==='SYNTHETIC_EXCLUDED').length,2);
});
test('Drive filename containing dump extension cannot certify source without bytes',()=>{
 const fs=populated();
 fs[0]!.items=[item('dump','shadow-ledger.dump','application/octet-stream')];
 const r=assessShadowDriveInventory(scan(fs));
 assert.equal(r.metadataCandidates.find(x=>x.id==='dump')?.admission,'METADATA_ONLY_NEEDS_BYTES');
 assert.equal(r.originalLedgerRecovered,false);
});
test('pagination must be exhausted and caller OAuth authenticated',()=>{
 const fs=populated();
 fs[0]={...fs[0]!,nextPageToken:'opaque-next'};
 fs[1]={...fs[1]!,fetchedWithAuthenticatedConnection:false};
 const r=assessShadowDriveInventory(scan(fs));
 assert.equal(r.state,'INCOMPLETE');
 assert.ok(r.reasonCodes.includes('INCOMPLETE_FOLDER_LEDGER'));
 assert.ok(r.reasonCodes.includes('INCOMPLETE_FOLDER_MARKET'));
});
test('omitted folder, swapped folder ID and conflicting Drive object are rejected',()=>{
 assert.throws(()=>assessShadowDriveInventory(scan(folders.slice(0,4))),/INPUT_INVALID/);
 const wrong=populated();
 wrong[0]={...wrong[0]!,folderId:'other'};
 assert.throws(()=>assessShadowDriveInventory(scan(wrong)),/FOLDER_SCOPE_INVALID/);
 const conflicting=populated();
 conflicting[0]!.items=[item('a','DIFFERENT FILE')];
 assert.throws(()=>assessShadowDriveInventory(scan(conflicting)),/DUPLICATE_FILE_CONFLICT/);
});
test('same ID in multiple folders does not inflate verified independent backups',()=>{
 const fs=populated();
 fs[0]!.items=[fs[3]!.items[0]!];
 const r=assessShadowDriveInventory(scan(fs));
 assert.equal(r.state,'INCOMPLETE');
 assert.ok(r.reasonCodes.includes('DUPLICATE_ITEM_ACROSS_FOLDERS'));
 assert.equal(r.folderCounts.health,1);
});
test('listing ordering does not change inventory hash',()=>{
 const a=assessShadowDriveInventory(scan(populated()));
 const b=assessShadowDriveInventory(scan(populated().reverse()));
 assert.equal(a.inventoryHash,b.inventoryHash);
});
test('bad file metadata and false success flags fail safely',()=>{
 const fs=populated();
 fs[2]!.items=[{...item('bad','shadow.dump'),sizeBytes:-1}];
 assert.throws(()=>assessShadowDriveInventory(scan(fs)),/ITEM_INVALID/);
 const failed=populated();
 failed[2]={...failed[2]!,enumerationSucceeded:false};
 assert.equal(assessShadowDriveInventory(scan(failed)).state,'INCOMPLETE');
});
