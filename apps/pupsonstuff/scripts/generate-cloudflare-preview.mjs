#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(appRoot, 'config/cloudflare-preview-template.json');

export function validatePreviewConfig(config) {
  const errors = [];
  const forbidden = ['routes', 'route', 'triggers', 'durable_objects', 'r2_buckets', 'd1_databases', 'queues', 'kv_namespaces'];
  if (config.name !== 'pupsonstuff-preview-free') errors.push('Unexpected Worker name.');
  if (config.main !== '.open-next/worker.js') errors.push('Invalid entry point.');
  if (!config.workers_dev) errors.push('workers.dev preview endpoint must be explicit.');
  if (config.assets?.directory !== '.open-next/assets' || config.assets?.binding !== 'ASSETS') errors.push('Invalid static asset boundary.');
  if (!config.compatibility_flags?.includes('nodejs_compat')) errors.push('Missing nodejs_compat.');
  if (forbidden.some(key => Object.hasOwn(config, key))) errors.push('No domains, cron or auxiliary resources permitted.');
  if (config.vars?.PUPSON_CLOUDFLARE_PREVIEW_ONLY !== 'true' ||
      config.vars?.PUPSON_FULFILLMENT_MODE !== 'dry_run' ||
      config.vars?.PUPSON_LIVE_COMMERCE_APPROVED !== 'false' ||
      config.vars?.PUPSON_PAYMENT_OPERATIONS_READY !== 'false' ||
      config.vars?.VERCEL_ENV !== 'preview') errors.push('Preview-only and commerce lock flags are mandatory.');
  const allowedVars = [
    'PUPSON_CLOUDFLARE_PREVIEW_ONLY', 'PUPSON_FULFILLMENT_MODE',
    'PUPSON_LIVE_COMMERCE_APPROVED', 'PUPSON_PAYMENT_OPERATIONS_READY',
    'VERCEL_ENV', 'PUPSON_DEPLOY_COMMIT'
  ];
  if (Object.keys(config.vars || {}).some(key => !allowedVars.includes(key))) errors.push('Unreviewed variable supplied.');
  if (Object.keys(config).some(key => ![
    'name','main','compatibility_date','compatibility_flags','assets','workers_dev','vars'
  ].includes(key))) errors.push('Unexpected Cloudflare configuration field.');
  if (config.vars?.PUPSON_DEPLOY_COMMIT && !/^[a-f0-9]{40}$/.test(config.vars.PUPSON_DEPLOY_COMMIT))
    errors.push('Commit SHA must contain 40 hexadecimal digits.');
  return errors;
}

export function createPreviewConfig(template, sha) {
  if (typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha))
    throw Error('A full, lowercase 40-digit Git SHA is required.');
  const config = structuredClone(template);
  config.vars.PUPSON_DEPLOY_COMMIT = sha;
  const errors = validatePreviewConfig(config);
  if (errors.length) throw Error(errors.join(' '));
  return config;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const template = JSON.parse(readFileSync(path, 'utf8'));
  const config = createPreviewConfig(template, process.env.GITHUB_SHA || '');
  writeFileSync(resolve(appRoot, 'wrangler.jsonc'), JSON.stringify(config, null, 2) + '\n', { flag:'w', mode:0o600 });
  console.log('PASS: generated restrictive view-only Worker config for exact Git SHA.');
}
