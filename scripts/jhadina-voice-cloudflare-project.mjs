#!/usr/bin/env node
/**
 * Provision/check ONLY the dedicated free-first static voice audition Pages
 * project, called exclusively by manually approved GitHub Actions. Never
 * touches an existing Git-linked, custom-domain or unrelated Pages project.
 */
const PROJECT = 'jhadina-voice-audition';
const ACCOUNT = /^[a-fA-F0-9]{32}$/;
const invalid = (message) => { throw new Error(message); };
const okProject = (record) => {
  if (!record || record.name !== PROJECT || record.source?.type ||
      (record.domains ?? []).some(domain => domain !== PROJECT + '.pages.dev')) {
    invalid('JH_VOICE_PAGES_EXISTING_PROJECT_SCOPE_MISMATCH');
  }
  return record;
};

export async function ensureVoicePagesProject({
  accountId,
  token,
  request = fetch,
}) {
  if (!ACCOUNT.test(accountId ?? '') || typeof token !== 'string' || !token.trim()) {
    invalid('JH_VOICE_PAGES_CREDENTIAL_SCOPE_REQUIRED');
  }
  const base = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/pages/projects';
  const opts = { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    redirect: 'error' };
  const probe = await request(base + '/' + PROJECT, { ...opts, method: 'GET' });
  if (probe.status === 200) {
    const data = await probe.json();
    if (data.success !== true) invalid('JH_VOICE_PAGES_PROBE_FAILED');
    okProject(data.result);
    return { status: 'existing', project: PROJECT, productionVoiceApproved: false };
  }
  if (probe.status !== 404) invalid('JH_VOICE_PAGES_PROBE_UNEXPECTED_STATUS:' + probe.status);
  const res = await request(base, { ...opts, method: 'POST',
    body: JSON.stringify({ name: PROJECT, production_branch: 'main' }) });
  if (res.status !== 200 && res.status !== 201) {
    invalid('JH_VOICE_PAGES_CREATE_REJECTED:' + res.status);
  }
  const output = await res.json();
  if (output.success !== true) invalid('JH_VOICE_PAGES_CREATE_FAILED');
  okProject(output.result);
  return { status: 'created', project: PROJECT, productionVoiceApproved: false };
}

if (process.argv[1]?.endsWith('jhadina-voice-cloudflare-project.mjs')) {
  ensureVoicePagesProject({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  }).then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(String(error)); process.exitCode = 1; });
}
