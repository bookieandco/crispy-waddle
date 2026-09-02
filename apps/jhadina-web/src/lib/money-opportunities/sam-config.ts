const SAM_API_BASE_URL = 'https://api.sam.gov/opportunities/v2/search';

export function getSamApiKey(): string | undefined {
  // Support the existing canonical name and the deployment secret name used by the project.
  return process.env.SAM_GOV_API_KEY?.trim() || process.env.sam_key?.trim() || undefined;
}

export function getSamApiUrl(): string {
  return SAM_API_BASE_URL;
}
