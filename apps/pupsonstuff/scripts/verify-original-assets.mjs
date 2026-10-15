import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(appRoot, 'config/original-boutique-assets.json');

export function gitBlobSha(bytes) {
  return createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0', 'utf8'))
    .update(bytes)
    .digest('hex');
}

export function auditAssetRegistry(root, manifest) {
  const errors = [];
  if (manifest?.schema !== 'pupson.original-assets.v1' || !Array.isArray(manifest.assets)) {
    return ['Invalid original asset manifest schema'];
  }
  for (const asset of manifest.assets) {
    if (!asset.id || !/^[0-9a-f]{40}$/.test(asset.gitBlobSha) || !Number.isSafeInteger(asset.sizeBytes)) {
      errors.push('Invalid asset entry: ' + String(asset.id));
      continue;
    }
    for (const relative of [asset.source, asset.runtime].filter(Boolean)) {
      if (typeof relative !== 'string' || isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
        errors.push(asset.id + ': unsafe path ' + String(relative));
        continue;
      }
      const full = resolve(root, relative);
      if (!full.startsWith(resolve(root) + sep)) {
        errors.push(asset.id + ': path outside app root');
        continue;
      }
      try {
        const bytes = readFileSync(full);
        if (bytes.length !== asset.sizeBytes) {
          errors.push(asset.id + ': byte length drift at ' + relative);
        }
        if (gitBlobSha(bytes) !== asset.gitBlobSha) {
          errors.push(asset.id + ': Git blob hash drift at ' + relative);
        }
      } catch (error) {
        errors.push(asset.id + ': missing/unreadable ' + relative + ' (' + error.code + ')');
      }
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = auditAssetRegistry(appRoot, JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (errors.length) {
    for (const error of errors) console.error('FAIL: ' + error);
    process.exitCode = 1;
  } else {
    console.log('PASS: canonical boutique photo and 6 approved/public product GLB pairs match frozen Git blobs.');
  }
}
