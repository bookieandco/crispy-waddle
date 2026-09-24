import { readFile } from 'node:fs/promises';

const paths = ['vercel.json', 'apps/jhadina-web/vercel.json'];

for (const path of paths) {
  const raw = await readFile(path, 'utf8');
  const config = JSON.parse(raw);
  const deploymentEnabled = config?.git?.deploymentEnabled;

  if (
    typeof deploymentEnabled !== 'object' ||
    deploymentEnabled === null ||
    deploymentEnabled['**'] !== false ||
    deploymentEnabled.main !== true
  ) {
    throw new Error(
      `${path} must disable automatic Git deployments for all branches except main`,
    );
  }
}

console.log('Vercel deployment guard verified: feature branches disabled, main enabled.');
