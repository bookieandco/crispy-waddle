const SAM_API_BASE_URL = 'https://api.sam.gov/opportunities/v2/search';

export function getSamApiKey(): string | undefined {
  return process.env.SAM_GOV_API_KEY?.trim() || undefined;
}

export function getSamApiUrl(): string {
  return SAM_API_BASE_URL;
}
