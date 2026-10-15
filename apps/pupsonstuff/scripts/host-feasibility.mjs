#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assess({ platform, plan, commercial = true, cron = '', bundleBytes = null, runtimeProven = false } = {}) {
  const blockers = [];
  const unknowns = [];
  if (platform === 'vercel' && plan === 'hobby') {
    if (commercial) blockers.push('Commercial storefront incompatible with Hobby terms.');
    if (cron && cron !== '0 0 * * *') blockers.push('Hobby does not allow sub-daily or other frequent cron configurations.');
  } else if (platform === 'cloudflare' && plan === 'free') {
    if (bundleBytes !== null && bundleBytes > 64 * 1024 * 1024) blockers.push('Worker bundle exceeds 64 MiB uncompressed.');
    if (bundleBytes === null) unknowns.push('Uncompressed Worker bundle has not been measured.');
    if (!runtimeProven) unknowns.push('True Worker-runtime canary of Next routes, Sharp, Stripe and Supabase missing.');
    unknowns.push('10 ms per-request CPU, concurrency and provider quotas require evidence.');
  } else blockers.push('Unknown or unreviewed hosting plan.');
  return {
    schema: 'pupson.host-feasibility.v1', platform, plan,
    verdict: blockers.length ? 'blocked' : 'candidate_not_certified',
    blockers, unknowns,
    certification: 'No live deployment, payment, order or resource creation is certified.',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const cron = cfg.crons?.find(x => x.path === '/api/internal/creative-worker')?.schedule ?? '';
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    vercel: assess({ platform:'vercel',plan:'hobby',cron }),
    cloudflare: assess({ platform:'cloudflare',plan:'free' }),
    mutations: 'none',
  }, null, 2));
}
