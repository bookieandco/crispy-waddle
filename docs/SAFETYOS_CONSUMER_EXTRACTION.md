# Consumer SafetyOS Extraction

Status: **source extraction complete**. Consumer LIVE remains fail-closed behind the existing physical/provider Safety gates.

## Objective

Turn the personalized Jhadina Safety implementation into a reusable consumer product layer without copying the owner's private profile, secrets, contacts, code words, or device assumptions.

Consumer SafetyOS is an orchestration/configuration layer over the existing governed Safety engine. It does **not** become a second emergency executor.

## Canonical flow

```
consumer enrollment
  -> privacy/capability/jurisdiction validation
  -> threat-tier plan (PLAN_ONLY)
  -> externally issued emergency pre-authorizations
  -> PersonalSafetyConfiguration
  -> canonical Safety runtime / ActionExecutor / durable audit
  -> controlled drill
  -> SAFETY-PROD-GATE.4
  -> SAFETY-PROD-GATE.5
  -> LIVE
```

No Consumer SafetyOS function may mint emergency authority, bypass policy, or promote synthetic/simulator evidence into a physical receipt.

## Consumer product surface

`packages/jhadina-core-spine/src/consumer-safetyos.ts` adds the reusable product contract:

- generic consumer enrollment IDs and owner/profile/protocol references;
- manual SOS and optional code-word activation;
- primary / secondary / critical contact tiers;
- trusted-contact, professional-service, and separately gated emergency-service contact kinds;
- elevated / critical escalation plans;
- privacy-minimal defaults;
- location/audio/video capture preferences;
- rolling-buffer and retention controls;
- manual-confirmed vs critical-preauthorized evidence release;
- jurisdiction/compliance receipt input rather than hard-coded legal assumptions;
- explicit external-emergency-service opt-in and provider reference;
- truthful platform capability disclosures;
- deterministic onboarding/readiness state;
- compilation into the existing `PersonalSafetyConfiguration`;
- no named-person search, face recognition, or plate identification.

## Defaults

A newly created Consumer SafetyOS enrollment starts with:

- manual SOS enabled;
- no code words configured;
- no contacts configured;
- no audio capture;
- no video capture;
- no location capture;
- no rolling buffer;
- evidence release disabled;
- external emergency services disabled;
- spatial/GEV context disabled;
- encrypted/off-device evidence requirements preserved when evidence is later enabled.

The product therefore starts private and inert rather than pretending permissions or providers exist.

## Threat tiers

Consumer SafetyOS supports a generic threat-plan layer:

- `check-in` — routine state, no automatic escalation implied;
- `elevated` — runs escalation steps marked elevated;
- `critical` — includes elevated + critical steps.

The returned plan is marked `PLAN_ONLY`. Actual notification/release work still requires governed pre-authorization and the canonical emergency executor.

## Evidence release

Three consumer release modes exist:

1. `disabled` — default.
2. `manual-confirmed` — explicit user confirmation required.
3. `critical-preauthorized` — confirmation may be omitted only after:
   - explicit automatic-release opt-in;
   - an allowed jurisdiction/compliance receipt;
   - valid recipient configuration;
   - successful `SAFETY-PROD-GATE.5` admission.

This preserves the requested black-box model without letting a consumer configuration object manufacture LIVE authority.

## Jurisdiction / legal policy boundary

SafetyOS does not infer recording or emergency-calling law.

Deployments provide a versioned `ConsumerJurisdictionPolicyReceipt` with evidence references for:

- recording capture;
- evidence release;
- external emergency-service provider use.

A missing, unknown, or restricted decision fails closed for the affected feature.

## Platform truth

`buildConsumerPlatformDisclosure()` turns native capability evidence into a user-facing support/unavailable list.

It explicitly warns when background video or local encrypted storage is unavailable. In particular, the product must never display background video as active on a platform/runtime that reports it unavailable.

## Onboarding / readiness

`evaluateConsumerSafetyOSReadiness()` has four truthful stages:

- `setup`
- `drill-required`
- `live-admission-required`
- `live-admitted`

Setup evidence is reference-only and includes, when relevant:

- encrypted profile configuration;
- device capability receipt;
- communications provider receipt;
- vault roundtrip receipt;
- code-word verifier receipt;
- controlled drill receipt.

Only an admitted `SAFETY-PROD-GATE.5` result produces `live-admitted`.

## Persistence

The consumer onboarding store persists **only non-secret readiness state**:

`public.jhadina_safety_consumer_setups`

Fields are limited to:

- owner ID;
- enrollment ID;
- product version;
- readiness stage;
- blocker codes;
- timestamp.

It does not store plaintext:

- code words;
- phone numbers;
- email addresses;
- addresses;
- confirmation phrases;
- encryption keys;
- evidence payloads.

RLS is enabled, `anon` / `authenticated` table privileges are revoked, and an explicit deny-all client RLS policy is installed. The current web adapter is service-role/server-only.

Migrations applied to the connected SWLC/Jhadina Supabase project:

- `20260927071900_consumer_safetyos_setup`
- `20260927072117_consumer_safetyos_setup_rls_deny`

## Certification

Consumer extraction tests certify:

- privacy-minimal defaults;
- different contact tiers by threat level;
- PLAN_ONLY threat routing;
- refusal to mint emergency pre-authorization;
- invasive GEV identity functions remain off;
- external emergency services require explicit opt-in/provider/policy;
- critical automatic evidence release requires Gate 5;
- unsupported native capabilities are displayed truthfully;
- setup cannot skip controlled drill;
- controlled drill cannot skip production admission.

Safety Core CI includes the consumer test file.

## What this does not claim

This extraction does not claim that a consumer phone can yet:

- record real AV bytes through SAFETY-NATIVE.3;
- perform unrestricted background video recording;
- deliver real SMS/calls without configured providers;
- contact public emergency services without deployment/jurisdiction/provider approval;
- pass physical reboot/app-kill/storage-pressure drills without real hardware;
- enter LIVE without Gate 5 runtime proofs.

Those are commissioning/runtime gates, not consumer-architecture gaps.

## Separation from the personalized Jhadina profile

The owner's private Jhadina profile remains a private configuration of the same underlying Safety engine.

Consumer SafetyOS contains reusable defaults and contracts only. It does not inherit:

- the owner's code words;
- trusted contacts;
- addresses;
- confirmation secrets;
- encryption material;
- threat-specific recipient identities;
- owner-only escalation choices.

This is the extraction boundary required to productize SafetyOS without turning a personalized safety system into a privacy leak.
