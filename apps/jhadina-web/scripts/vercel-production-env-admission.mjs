const API = 'https://api.vercel.com';

const token = process.env.VERCEL_TOKEN?.trim();
const teamId = process.env.VERCEL_TEAM_ID?.trim();
const projectId = process.env.VERCEL_PROJECT_ID?.trim();
const projectName = process.env.VERCEL_PROJECT_NAME?.trim();
const productionOrigin = process.env.JHADINA_PRODUCTION_ORIGIN?.trim();
const expectedSha = process.env.GITHUB_SHA?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

for (const [name, value] of Object.entries({
  VERCEL_TOKEN: token,
  VERCEL_TEAM_ID: teamId,
  VERCEL_PROJECT_ID: projectId,
  VERCEL_PROJECT_NAME: projectName,
  JHADINA_PRODUCTION_ORIGIN: productionOrigin,
  GITHUB_SHA: expectedSha,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
})) {
  if (!value) throw new Error(`${name} is required for production admission`);
}

function apiUrl(path) {
  const value = new URL(path, API);
  value.searchParams.set('teamId', teamId);
  return value.toString();
}

async function request(path, init = {}, accepted = [200, 201]) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!accepted.includes(response.status)) {
    const detail = await response.text();
    throw new Error(
      `${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail.slice(0, 1000)}`,
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

async function syncEnvironment() {
  const envs = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      value: supabaseUrl,
      type: 'plain',
      target: ['production'],
      comment: 'GLOBAL-PROD.FINAL durable Memory/Auth Supabase origin.',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      value: publishableKey,
      type: 'plain',
      target: ['production'],
      comment: 'GLOBAL-PROD.FINAL public Supabase browser/server key.',
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      value: serviceRoleKey,
      type: 'encrypted',
      target: ['production'],
      comment: 'GLOBAL-PROD.FINAL server-only durable Memory service role.',
    },
  ];

  await request(
    `/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
    {
      method: 'POST',
      body: JSON.stringify(envs),
    },
    [200, 201],
  );

  console.log('Synced required Jhadina Supabase production environment variables.');
}

async function createProductionDeployment() {
  return request(
    '/v13/deployments?forceNew=1',
    {
      method: 'POST',
      body: JSON.stringify({
        name: projectName,
        project: projectId,
        target: 'production',
        gitSource: {
          type: 'github',
          org: 'bookieandco',
          repo: 'crispy-waddle',
          ref: 'main',
        },
        withLatestCommit: true,
      }),
    },
    [200, 201],
  );
}

async function waitForDeployment(deploymentId) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const deployment = await request(`/v13/deployments/${deploymentId}`);
    const state = deployment.readyState ?? deployment.state ?? 'UNKNOWN';
    const sha = deployment.meta?.githubCommitSha ?? null;

    console.log(
      JSON.stringify({
        attempt,
        deploymentId,
        state,
        sha,
      }),
    );

    if (state === 'ERROR' || state === 'CANCELED') {
      throw new Error(`Production deployment ${deploymentId} ended in ${state}`);
    }

    if (state === 'READY') {
      if (sha !== expectedSha) {
        throw new Error(
          `Production deployment READY on unexpected SHA ${sha ?? 'unknown'}; expected ${expectedSha}`,
        );
      }
      return deployment;
    }

    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  throw new Error('Timed out waiting for exact-SHA Vercel production deployment');
}

async function waitForHealth() {
  const url = new URL('/api/health', productionOrigin).toString();

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'jhadina-global-prod-final-env-sync' },
      redirect: 'follow',
    });
    const body = await response.text();

    console.log(
      JSON.stringify({
        healthAttempt: attempt,
        status: response.status,
        ok: response.ok,
      }),
    );

    if (response.status === 200) {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error('Production health returned 200 with non-JSON body');
      }
      if (parsed?.success !== true) {
        throw new Error('Production health returned 200 without success=true');
      }
      return parsed;
    }

    if (attempt === 30) {
      throw new Error(
        `Production health never reached HTTP 200; final status ${response.status}: ${body.slice(0, 500)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

await syncEnvironment();
const created = await createProductionDeployment();
if (!created?.id) throw new Error('Vercel did not return a deployment id');
console.log(`Triggered production redeployment ${created.id}`);

const deployment = await waitForDeployment(created.id);
const health = await waitForHealth();

console.log(
  JSON.stringify(
    {
      admitted: true,
      deploymentId: deployment.id,
      deploymentSha: deployment.meta?.githubCommitSha ?? null,
      productionOrigin,
      healthStatus: health.status ?? health.success ?? null,
    },
    null,
    2,
  ),
);
