import { appendFileSync } from 'node:fs';
const API = 'https://api.vercel.com';
const token = process.env.VERCEL_TOKEN?.trim();
const teamId =
  process.env.VERCEL_TEAM_ID?.trim() || 'team_NYQJ3NwijZZ6UJQdOdc5FjmX';
const projectName = process.env.PUPSON_VERCEL_PROJECT?.trim() || 'pupsonstuff';
const repository = 'bookieandco/crispy-waddle';
const rootDirectory = 'apps/pupsonstuff';
const canonicalDomain = 'www.pupsonstuff.com';
const redirectDomain = 'pupsonstuff.com';

if (!token) {
  throw new Error('VERCEL_TOKEN is required. No Vercel mutation was attempted.');
}

function url(path) {
  const value = new URL(path, API);
  value.searchParams.set('teamId', teamId);
  return value.toString();
}

async function request(path, init = {}, accepted = [200, 201]) {
  const response = await fetch(url(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!accepted.includes(response.status)) {
    const detail = await response.text();
    const error = new Error(
      `${init.method || 'GET'} ${path} failed (${response.status}): ${detail.slice(0, 800)}`
    );
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function findProject() {
  try {
    return await request(`/v9/projects/${encodeURIComponent(projectName)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function createProject() {
  return request('/v11/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      framework: 'nextjs',
      rootDirectory,
      gitRepository: {
        type: 'github',
        repo: repository,
      },
      installCommand: 'cd ../.. && corepack enable && pnpm install --frozen-lockfile',
      buildCommand: 'cd ../.. && pnpm --filter @jhadina/pupsonstuff build',
    }),
  });
}

async function ensureProject() {
  let project = await findProject();
  if (!project) {
    project = await createProject();
    console.log(`Created Vercel project: ${project.name} (${project.id})`);
    return project;
  }

  if (project.rootDirectory !== rootDirectory) {
    throw new Error(
      `Refusing to reuse Vercel project "${projectName}" because rootDirectory is "${project.rootDirectory ?? ''}", expected "${rootDirectory}".`
    );
  }
  const linkedRepo = project.link?.repo || project.gitRepository?.repo;
  if (linkedRepo && linkedRepo !== repository) {
    throw new Error(
      `Refusing to reuse Vercel project "${projectName}" because it is linked to ${linkedRepo}, expected ${repository}.`
    );
  }
  console.log(`Using existing Vercel project: ${project.name} (${project.id})`);
  return project;
}

async function listDomains() {
  const data = await request(
    `/v9/projects/${encodeURIComponent(projectName)}/domains?limit=100`
  );
  return Array.isArray(data.domains) ? data.domains : [];
}

async function addDomain(name, options = {}) {
  return request(`/v10/projects/${encodeURIComponent(projectName)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name, ...options }),
  });
}

async function ensureDomains() {
  const domains = await listDomains();
  const byName = new Map(domains.map((domain) => [domain.name, domain]));

  if (!byName.has(canonicalDomain)) {
    await addDomain(canonicalDomain);
    console.log(`Attached canonical domain: ${canonicalDomain}`);
  } else {
    console.log(`Canonical domain already attached: ${canonicalDomain}`);
  }

  const existingRedirect = byName.get(redirectDomain);
  if (!existingRedirect) {
    await addDomain(redirectDomain, {
      redirect: canonicalDomain,
      redirectStatusCode: 308,
    });
    console.log(`Attached redirect: ${redirectDomain} -> ${canonicalDomain}`);
  } else if (existingRedirect.redirect !== canonicalDomain) {
    throw new Error(
      `${redirectDomain} is already attached but does not redirect to ${canonicalDomain}. Refusing to overwrite it automatically.`
    );
  }

  const refreshed = await listDomains();
  const relevant = refreshed.filter((domain) =>
    [canonicalDomain, redirectDomain].includes(domain.name)
  );
  for (const domain of relevant) {
    console.log(
      JSON.stringify({
        domain: domain.name,
        verified: Boolean(domain.verified),
        redirect: domain.redirect || null,
        redirectStatusCode: domain.redirectStatusCode || null,
        verification: Array.isArray(domain.verification)
          ? domain.verification.map((item) => ({
              type: item.type,
              domain: item.domain,
              value: item.value,
              reason: item.reason,
            }))
          : [],
      })
    );
  }
  return relevant;
}

const requiredSecrets = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PRINTIFY_API_KEY',
  'PRINTIFY_SHOP_ID',
  'OPENAI_API_KEY',
  'MUAPI_API_KEY',
  'PUPSON_ADMIN_USERNAME',
  'PUPSON_ADMIN_PASSWORD',
  'PUPSON_ADMIN_SESSION_SECRET',
  'PUPSON_PRINTIFY_WEBHOOK_SECRET',
  'CRON_SECRET',
];

const optionalProviderSecrets = [
  'HUGGINGFACE_API_KEY',
  'PUPSON_BACKGROUND_REMOVER_URL',
  'PUPSON_BACKGROUND_REMOVER_TOKEN',
  'KNOCKOUT_TOKEN',
  'PUPSON_KNOCKOUT_URL',
  'PUPSON_UPSCALER_URL',
  'PUPSON_UPSCALER_TOKEN',
];

async function upsertEnvironment() {
  const envs = [
    {
      key: 'PUPSON_PUBLIC_ORIGIN',
      value: 'https://www.pupsonstuff.com',
      type: 'plain',
      target: ['production'],
      comment: 'Canonical PupsonStuff production origin.',
    },
    {
      key: 'PUPSON_FULFILLMENT_MODE',
      value: 'dry_run',
      type: 'plain',
      target: ['production', 'preview'],
      comment: 'Fail-closed until PS-RECON.8 physical samples pass.',
    },
    {
      key: 'PUPSON_OPENAI_IMAGE_MODEL',
      value: 'gpt-image-2.5-sunburst',
      type: 'plain',
      target: ['production', 'preview'],
      comment: 'Pinned PupsonStuff image model for certification.',
    },
  ];

  for (const key of [...requiredSecrets, ...optionalProviderSecrets]) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    envs.push({
      key,
      value,
      type: 'sensitive',
      target: ['production', 'preview'],
      comment: 'Synced by PupsonStuff Vercel bootstrap.',
    });
  }

  await request(
    `/v10/projects/${encodeURIComponent(projectName)}/env?upsert=true`,
    {
      method: 'POST',
      body: JSON.stringify(envs),
    },
    [200, 201]
  );

  const missingRequired = requiredSecrets.filter(
    (key) => !process.env[key]?.trim()
  );
  const hasBackgroundRemover =
    Boolean(process.env.PUPSON_BACKGROUND_REMOVER_URL?.trim()) ||
    Boolean(process.env.KNOCKOUT_TOKEN?.trim());
  const hasUpscaler =
    Boolean(process.env.PUPSON_UPSCALER_URL?.trim()) ||
    Boolean(process.env.KNOCKOUT_TOKEN?.trim());

  if (!hasBackgroundRemover) missingRequired.push('BACKGROUND_REMOVER_PROVIDER');
  if (!hasUpscaler) missingRequired.push('IMAGE_UPSCALER_PROVIDER');

  const environmentReady = missingRequired.length === 0;
  if (!environmentReady) {
    console.log(
      `Project/domain bootstrap complete, but provider certification remains blocked by: ${missingRequired.join(', ')}`
    );
  } else {
    console.log('All required PS-RECON server environment inputs were supplied to bootstrap.');
  }
  return { environmentReady, missingRequired };
}

const project = await ensureProject();
const domains = await ensureDomains();
const environment = await upsertEnvironment();

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `project_id=${project.id}`,
      `environment_ready=${environment.environmentReady ? 'true' : 'false'}`,
      `canonical_domain_verified=${
        domains.find((domain) => domain.name === canonicalDomain)?.verified ? 'true' : 'false'
      }`,
      '',
    ].join('\n')
  );
}

console.log(
  JSON.stringify(
    {
      projectId: project.id,
      projectName,
      teamId,
      repository,
      rootDirectory,
      canonicalOrigin: 'https://www.pupsonstuff.com',
      domains: domains.map((domain) => ({
        name: domain.name,
        verified: Boolean(domain.verified),
        redirect: domain.redirect || null,
      })),
      environmentReady: environment.environmentReady,
      missingRequired: environment.missingRequired,
      fulfillmentMode: 'dry_run',
    },
    null,
    2
  )
);
