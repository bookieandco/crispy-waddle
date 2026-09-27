import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_MARKET_DATA_REFERENCE_IDS } from './money-market-data-reference-seed.js';

test('market data donor references are pinned with verified permissive code licenses', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_MARKET_DATA_REFERENCE_IDS) {
    assert.ok(INITIAL_REFERENCE_IDS.includes(referenceId));
    const reference = registry.getReference(referenceId);
    assert.ok(reference, referenceId);
    assert.equal(reference.traceabilityStatus, 'EXTERNALLY_VERIFIED');

    const verification = registry.latestSourceVerification(referenceId);
    assert.ok(verification, referenceId);
    assert.equal(verification.sourceVerificationStatus, 'PINNED');
    assert.equal(verification.licenseFinding, 'VERIFIED');
    assert.equal(verification.licenseReusePolicy, 'PERMISSIVE');
  }
});

test('market data donor mappings keep data rights separate from code-license reuse', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  const global = registry.getMapping(
    'map:money:global-stock-data-source-governance',
  );
  assert.ok(global);
  assert.equal(global.adoptionStatus, 'ADAPTED');
  assert.ok(
    global.borrowedConcepts.includes(
      'code-license and data-rights separation',
    ),
  );

  const scraper = registry.getMapping(
    'map:money:web-scraping-reference-gate',
  );
  assert.ok(scraper);
  assert.equal(scraper.adoptionStatus, 'ADAPTED');
  assert.ok(
    scraper.adaptationNotes.includes(
      'not production data sources',
    ),
  );

  const lse = registry.getMapping(
    'map:money:lse-data-provider-rights',
  );
  assert.ok(lse);
  assert.equal(lse.adoptionStatus, 'ADAPTED');
  assert.ok(
    lse.borrowedConcepts.includes(
      'client-code license versus provider-data rights',
    ),
  );
});
