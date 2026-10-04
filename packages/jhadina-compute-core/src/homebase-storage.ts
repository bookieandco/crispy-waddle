export type HomebaseStorageContract={
  root:string;
  backupRoot:string;
  databaseUrlRef:string;
  objectEndpoint:string;
  queueEndpoint:string;
  canonicalDatabase:'POSTGRES';
  canonicalObjects:'S3_COMPATIBLE';
  encryptedBackup:boolean;
  backupTargetSeparate:boolean;
};

export function validateHomebaseStorage(c:HomebaseStorageContract):readonly string[]{
  const r:string[]=[];
  if(!c.root.startsWith('/'))r.push('HOMEBASE_DATA_ROOT_ABSOLUTE_REQUIRED');
  if(!c.backupRoot.startsWith('/'))r.push('HOMEBASE_BACKUP_ROOT_ABSOLUTE_REQUIRED');
  if(c.root===c.backupRoot)r.push('HOMEBASE_BACKUP_TARGET_MUST_BE_SEPARATE');
  if(!c.databaseUrlRef.trim())r.push('HOMEBASE_DATABASE_URL_REF_REQUIRED');
  if(!c.objectEndpoint.trim())r.push('HOMEBASE_OBJECT_ENDPOINT_REQUIRED');
  if(!c.queueEndpoint.trim())r.push('HOMEBASE_QUEUE_ENDPOINT_REQUIRED');
  if(c.encryptedBackup!==true)r.push('HOMEBASE_ENCRYPTED_BACKUP_REQUIRED');
  if(c.backupTargetSeparate!==true)r.push('HOMEBASE_SEPARATE_BACKUP_REQUIRED');
  return Object.freeze([...new Set(r)]);
}

export function defaultHomebaseStorage(root='/srv/jhadina',backupRoot='/srv/jhadina-backups'):HomebaseStorageContract{
  return Object.freeze({
    root,
    backupRoot,
    databaseUrlRef:'secret:DATABASE_URL',
    objectEndpoint:'http://127.0.0.1:9000',
    queueEndpoint:'nats://127.0.0.1:4222',
    canonicalDatabase:'POSTGRES',
    canonicalObjects:'S3_COMPATIBLE',
    encryptedBackup:true,
    backupTargetSeparate:true,
  });
}
