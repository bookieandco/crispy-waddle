# Jhadina Intelligence Fabric

## Purpose

Create one reusable evidence-collection and change-detection layer for CampaignOS, SocialOS, Money Core, OverageOS, and general Jhadina intelligence.

## Pipeline

Source registry -> collection router -> source adapter -> raw observation -> normalize/dedupe -> evidence ledger -> change events -> daily synthesis -> Jhadina.

## Collector roles

- Firecrawl: discovery, crawl, scrape, structured extraction and asynchronous crawl callbacks.
- Crawlee: durable crawler runtime, request queues, retries and browser/HTTP collection.
- Scrapling: adaptive extraction for pages whose structure changes.
- changedetection.io: watch state and change detection; use it to avoid repeatedly deep-crawling unchanged pages.

These are adapters/engines, not the system of record.

## Operating model

1. Register a source with domain, URL, collection method, cadence and policy.
2. Watch cheap signals first where possible.
3. When a change is detected, enqueue a prioritized deep collection.
4. Capture raw material with timestamp, source and content hash.
5. Normalize into EvidenceItem and retain provenance.
6. Emit ChangeEvent when the current hash differs from the prior observation.
7. Deduplicate repeated observations before intelligence synthesis.
8. Generate a DailyJhadinaLog grouped by Campaign, Social, Money, Overage and General.
9. Require human review for consequential decisions or actions.

## Source policy

Prefer official APIs and authorized/licensed data where available. Public-web collection must respect applicable terms, robots/rate limits, authentication boundaries and privacy requirements. Do not use the fabric to bypass access controls or collect private credentials/data.

## Daily report contract

The daily report should answer:

- What changed?
- What is newly important?
- What evidence supports it?
- How confident are we?
- Which OS does it affect?
- What remains unresolved?
- Does it require user attention?
- What is the next useful action?

## Cross-OS examples

### CampaignOS
Polls + public statistics + politician communications + legislation + local reporting -> issue intelligence.

### SocialOS
Account/content changes + public trends + engagement -> content and account intelligence.

### Money Core
Official company/market information + filings + authorized market data + public signals -> monitored financial intelligence. Social signals are informational and never an automatic trading instruction.

### OverageOS
Government pages + notices + parcel/auction sources + public reporting -> opportunity change detection.

## Non-goals

The fabric is not an autonomous political persuasion engine, trading engine, or claims-of-fact generator. Jhadina must preserve source provenance, distinguish observation from interpretation, and surface uncertainty.
