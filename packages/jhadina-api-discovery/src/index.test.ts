import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiMegaListMarkdownSource,
  candidateId,
  deduplicateCandidates,
  normalizeExternalUrl,
} from './index.js';

test('normalizes URLs without fragments', () => {
  assert.equal(normalizeExternalUrl('https://example.com/api#docs'), 'https://example.com/api');
  assert.equal(candidateId('https://example.com/api#one'), candidateId('https://example.com/api#two'));
});

test('imports API-mega-list markdown rows as pending candidates', () => {
  const source = new ApiMegaListMarkdownSource('AI');
  const candidates = source.discover(`
| API Name | Description |
|----------|-------------|
| [Weather API](https://example.com/weather) | Current weather data. |
| [Browser API](https://example.com/browser) | Browser automation. |
`);

  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0], {
    id: 'https://example.com/weather',
    name: 'Weather API',
    description: 'Current weather data.',
    category: 'AI',
    externalUrl: 'https://example.com/weather',
    source: 'cporter202/API-mega-list',
    sourceUrl: 'https://github.com/cporter202/API-mega-list',
    riskClass: 'unknown',
    sideEffect: 'unknown',
    qualificationStatus: 'qualification_pending',
  });
});

test('deduplicates candidates by normalized identity', () => {
  const source = new ApiMegaListMarkdownSource('AI');
  const candidates = source.discover(`
| API Name | Description |
|----------|-------------|
| [One](https://example.com/api#first) | First. |
| [Duplicate](https://example.com/api#second) | Duplicate. |
`);

  assert.equal(deduplicateCandidates(candidates).length, 1);
});

test('invalid external URLs are not promoted', () => {
  const source = new ApiMegaListMarkdownSource('AI');
  const candidates = source.discover(`
| API Name | Description |
|----------|-------------|
| [Broken](not-a-url) | Invalid. |
`);

  assert.equal(candidates.length, 0);
});
