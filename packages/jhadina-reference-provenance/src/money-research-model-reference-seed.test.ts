import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_RESEARCH_MODEL_REFERENCE_IDS } from './money-research-model-reference-seed.js';

test('stock research and crypto equilibrium donor references are pinned', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_RESEARCH_MODEL_REFERENCE_IDS) {
    assert.ok(INITIAL_REFERENCE_IDS.includes(referenceId));
    const reference = registry.getReference(referenceId);
    assert.ok(reference, referenceId);
    assert.equal(reference.traceabilityStatus, 'EXTERNALLY_VERIFIED');

    const verification = registry.latestSourceVerification(referenceId);
    assert.ok(verification, referenceId);
    assert.equal(verification.sourceVerificationStatus, 'PINNED');
  }
});

test('Spotify notebook remains no-license and evaluation-only', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const verification = registry.latestSourceVerification(
    'github:Yonas650/Spotify_Stock_Analysis',
  );
  const mapping = registry.getMapping(
    'map:money:spotify-stock-analysis-workflow',
  );

  assert.ok(verification);
  assert.equal(verification.licenseFinding, 'NO_LICENSE_FILE');
  assert.equal(verification.licenseReusePolicy, 'NO_LICENSE');

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'EVALUATED');
  assert.deepEqual(mapping.borrowedArtifactKinds, ['IDEA_ONLY']);
  assert.ok(
    mapping.adaptationNotes.includes(
      'rejects random time-series train/test splitting',
    ),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});

test('crypto equilibrium donor is MIT but adapted output remains research-only', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const verification = registry.latestSourceVerification(
    'github:AmirhosseinHonardoust/Crypto-Price-Equilibrium-Simulator',
  );
  const mapping = registry.getMapping(
    'map:money:market-force-equilibrium',
  );

  assert.ok(verification);
  assert.equal(verification.licenseFinding, 'VERIFIED');
  assert.equal(verification.licenseExpression, 'MIT');
  assert.equal(verification.licenseReusePolicy, 'PERMISSIVE');

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'ADAPTED');
  assert.ok(
    mapping.adaptationNotes.includes('single signed-force convention'),
  );
  assert.ok(
    mapping.adaptationNotes.includes('cannot authorize trades'),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});
