/**
 * Provider boundary for the ApiVault Skip Trace n8n community node.
 * OverageOS consumes normalized observations only; the provider never
 * determines entitlement or authorizes outreach.
 *
 * This adapter intentionally does not implement scraping, proxy rotation,
 * CAPTCHA bypass, or anti-bot evasion. n8n/ApiVault remains responsible for
 * its configured, permitted data access.
 */

function normalizeApiVaultResult(result, context = {}) {
  return {
    provider: 'apivault-n8n-skip-trace',
    sourceClass: 'PEOPLE_SEARCH_PROVIDER',
    queryType: context.queryType || null,
    candidateId: context.candidateId || null,
    observedAt: context.observedAt || new Date().toISOString(),
    name: result?.name || null,
    age: result?.age ?? null,
    currentAddress: result?.currentAddress || null,
    previousAddresses: Array.isArray(result?.previousAddresses) ? result.previousAddresses : [],
    phones: Array.isArray(result?.phones) ? result.phones : [],
    emails: Array.isArray(result?.emails) ? result.emails : [],
    profileUrl: result?.profileUrl || null,
    aliases: Array.isArray(result?.aliases) ? result.aliases : [],
    relatives: Array.isArray(result?.relatives) ? result.relatives : [],
    provenance: {
      source: 'ApiVault via n8n',
      sourceRecordId: result?.id || null,
      sourceUrl: result?.profileUrl || null,
    },
    ownershipStatus: 'UNCONFIRMED',
    outreachStatus: 'NOT_AUTHORIZED',
  };
}

function buildApiVaultQuery({ name, propertyAddress, phone }) {
  if (name) return { searchBy: 'name', query: name };
  if (propertyAddress) return { searchBy: 'address', query: propertyAddress };
  if (phone) return { searchBy: 'phone', query: phone };
  throw new Error('ApiVault query requires name, propertyAddress, or phone');
}

function normalizeBatch(results, context = {}) {
  return (results || []).map((result) => normalizeApiVaultResult(result, context));
}

module.exports = {
  buildApiVaultQuery,
  normalizeApiVaultResult,
  normalizeBatch,
};
