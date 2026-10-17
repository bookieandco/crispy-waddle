import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROJECT_REF = 'kqbkaozfjubkjevdfvic';
export function canaryConfig(env) {
  const missing = [
    'JTV_CANARY_URL', 'JTV_CANARY_PUBLISHABLE_KEY',
    'JTV_CANARY_OWNER_JWT', 'JTV_CANARY_SECOND_JWT',
    'JTV_CANARY_EXPECTED_OWNER_ID',
  ].filter(key => !env[key]?.trim());
  if (env.JTV_CANARY_ALLOW_WRITES !== 'YES' || env.JTV_CANARY_TEST_USERS_ONLY !== 'YES') {
    missing.push('JTV_CANARY_ALLOW_WRITES=YES and JTV_CANARY_TEST_USERS_ONLY=YES');
  }
  let origin;
  try { origin = new URL(env.JTV_CANARY_URL); } catch { missing.push('JTV_CANARY_URL(valid HTTPS URL)'); }
  if (origin && (origin.protocol !== 'https:' || origin.username || origin.password ||
    origin.hostname !== PROJECT_REF + '.supabase.co' || origin.pathname !== '/')) {
    missing.push('JTV_CANARY_URL(canonical Swlc Supabase origin required)');
  }
  if (env.JTV_CANARY_OWNER_JWT && env.JTV_CANARY_OWNER_JWT === env.JTV_CANARY_SECOND_JWT) {
    missing.push('two distinct authenticated JWTs');
  }
  return { ready: missing.length === 0, missing };
}

function authPayload(jwt) {
  try {
    const part = jwt.split('.')[1];
    const claim = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return claim?.role === 'authenticated' && typeof claim.sub === 'string' ? claim : null;
  } catch { return null; }
}

export async function runCanary(env, fetchFn = fetch) {
  const validated = canaryConfig(env);
  if (!validated.ready) throw Error('NOT_COMMISSIONED: ' + validated.missing.join(', '));
  const ownerPayload = authPayload(env.JTV_CANARY_OWNER_JWT);
  const secondPayload = authPayload(env.JTV_CANARY_SECOND_JWT);
  if (!ownerPayload || !secondPayload || ownerPayload.sub === secondPayload.sub ||
      ownerPayload.sub !== env.JTV_CANARY_EXPECTED_OWNER_ID) {
    throw Error('NOT_COMMISSIONED: owner/second authenticated JWT identity mismatch');
  }
  const base = new URL(env.JTV_CANARY_URL).origin;
  const key = env.JTV_CANARY_PUBLISHABLE_KEY;
  const actors = [
    { name: 'owner', id: ownerPayload.sub, jwt: env.JTV_CANARY_OWNER_JWT },
    { name: 'second', id: secondPayload.sub, jwt: env.JTV_CANARY_SECOND_JWT },
  ];
  const call = async (actor, endpoint, method = 'GET', body) => {
    const response = await fetchFn(base + endpoint, {
      method, redirect: 'error', cache: 'no-store',
      headers: {
        apikey: key, Authorization: 'Bearer ' + actor.jwt,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
    // Never log response bodies or JWTs: provider errors can contain private data.
    return { ok: response.ok, status: response.status,
      data: response.ok ? await response.json().catch(() => null) : null };
  };
  for (const actor of actors) {
    const result = await call(actor, '/auth/v1/user');
    if (!result.ok || result.data?.id !== actor.id) {
      throw Error('NOT_COMMISSIONED: real user authentication failed for ' + actor.name);
    }
  }
  const mediaId = 'jellyfin:jtv-postmerge-canary-' + randomBytes(12).toString('hex');
  const denialId = mediaId + '-denied';
  const query = '?select=user_id,media_id&media_id=eq.' + encodeURIComponent(mediaId);
  const checkpointQuery = '?select=user_id,media_id,position_seconds,observed_at&media_id=eq.' + encodeURIComponent(mediaId);
  const created = new Set();
  const evidence = [];
  const assert = (condition, label) => {
    if (!condition) throw Error('CANARY_FAILED: ' + label);
    evidence.push(label);
  };
  try {
    for (const actor of actors) {
      const result = await call(actor, '/rest/v1/jtv_watchlist', 'POST',
        { user_id: actor.id, media_id: mediaId });
      assert(result.ok, actor.name + ' can save own test media');
      created.add(actor.id);
    }
    for (const actor of actors) {
      const list = await call(actor, '/rest/v1/jtv_watchlist' + query);
      assert(list.ok && Array.isArray(list.data) &&
        list.data.length === 1 && list.data[0].user_id === actor.id,
        actor.name + ' cannot read other account watchlist');
    }
    const cross = await call(actors[0], '/rest/v1/jtv_watchlist', 'POST',
      { user_id: actors[1].id, media_id: denialId });
    assert(!cross.ok, 'owner cannot insert for the second user');
    const now = Date.now();
    const newer = new Date(now - 10000).toISOString();
    const older = new Date(now - 20000).toISOString();
    const write = (position, observed) => ({
      p_media_id: mediaId, p_position_seconds: position,
      p_duration_seconds: 600, p_observed_at: observed,
    });
    let res = await call(actors[0], '/rest/v1/rpc/jtv_record_checkpoint', 'POST', write(120, newer));
    assert(res.ok, 'owner can record a checkpoint');
    res = await call(actors[0], '/rest/v1/rpc/jtv_record_checkpoint', 'POST', write(1, older));
    assert(res.ok, 'stale checkpoint call is accepted but not applied');
    const own = await call(actors[0], '/rest/v1/jtv_playback_checkpoints' + checkpointQuery);
    assert(own.ok && own.data?.length === 1 && own.data[0].position_seconds === 120,
      'newer checkpoint is monotonic');
    const hidden = await call(actors[1], '/rest/v1/jtv_playback_checkpoints' + checkpointQuery);
    assert(hidden.ok && hidden.data?.length === 0, 'second user cannot read owner checkpoint');
    return { status: 'PASS', evidence, project: PROJECT_REF,
      accountCount: 2, fixture: 'ephemeral; cleaned up', actualDeviceVerified: false };
  } finally {
    const problems = [];
    for (const actor of actors) {
      if (created.has(actor.id)) {
        for (const table of ['jtv_watchlist', 'jtv_playback_checkpoints']) {
          const endpoint = '/rest/v1/' + table + '?media_id=eq.' +
            encodeURIComponent(mediaId) + '&user_id=eq.' + encodeURIComponent(actor.id);
          try {
            const deleted = await call(actor, endpoint, 'DELETE');
            if (!deleted.ok) problems.push(actor.name + ':' + table);
          } catch { problems.push(actor.name + ':' + table); }
        }
      }
    }
    if (problems.length) throw Error('CANARY_CLEANUP_UNVERIFIED: ' + problems.join(', '));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCanary(process.env).then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }).catch(error => {
    process.stderr.write(String(error.message).slice(0, 700) + '\n');
    process.exitCode = 2;
  });
}
