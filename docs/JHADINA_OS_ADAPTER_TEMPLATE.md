# Jhadina OS Adapter Template

Every OS registers capabilities through `ActionAdapter` and executes behind the same deterministic Policy/Security Core and Action Executor.

## Required contract

```ts
{
  domain: 'your-domain',
  capability: 'noun.verb',
  execute(input, context) { ... }
}
```

## Rules

1. Never call external providers before policy authorization.
2. Never let an LLM decide authorization.
3. Public publishing and consequential external actions must remain approval-gated.
4. Emit an auditable result and preserve `requestId`/`projectId`.
5. Keep provider-specific APIs behind the adapter.
6. Prefer idempotent actions and explicit capability names.

## Registered domains

- MusicOS — live adapter backed by `@jhadina/music-core`.
- DirectorOS — take/project adapter; generation engine remains injectable.
- Creator Workstation — project/assets/export adapter.
- CampaignOS — template ready for research, geography, content, reels and ads.
- OverageOS — template ready for discovery, records, verification and claim workflows.
- Commerce/PupsonStuff — template ready for products, ads, reels and shop content.
- TVOS — template ready for discovery, watch context and production.
- PodcastOS — template ready for research, evidence maps, scripts and clips.

## Finance / Books

`frappe/books` is registered as a **reference integration** for Money/Finance Core. Its accounting concepts can be adapted into a Jhadina-owned ledger boundary; the external application must not bypass Jhadina policy, audit or execution controls.
