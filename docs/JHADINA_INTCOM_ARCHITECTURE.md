# Jhadina Intelligence & Communications Loop

## Human architecture decision

JH-042, JH-012 and JH-013 are one program with separate governed capabilities, not one package or a new authority layer.

Canonical loop:

```
observe -> evidence -> governed context -> intelligence/strategy -> proposal
        -> policy/approval -> ActionExecutor -> capability -> outcome evidence
        -> activity/context
```

## Component boundaries

### INTCOM.1 — Operating/activity layer
Current main already satisfies this foundation through the reconciled JH-042 slice. JANET, DELIA and MARISA are roles inside the canonical spine, not independently executable agents. The durable Activity surface projects the existing SupabaseAuditLedger; it does not create an agent audit store.

### INTCOM.2 — Passive observation
JH-012 becomes the first observation-provider track. Shodan is an adapter behind a provider-neutral passive-observation contract. Observations are evidence, not conclusions. This track authorizes no active scanning, exploitation, mutation, or autonomous target selection.

### INTCOM.3 — Governed communications
JH-013 becomes a transport-neutral communications capability. Communication intent must pass identity, policy and approval before a transport adapter can send. Transports do not receive policy authority. Reticulum is one future adapter, not the communications architecture itself.

### INTCOM.4 — Evidence/activity fusion
Observation evidence, intelligence proposals, policy decisions, execution receipts and communication delivery receipts project into the existing durable activity/evidence path. No second event/audit authority.

### INTCOM.5 — Reticulum adapter
Implement only after the transport-neutral contracts and recipient/device identity boundaries are stable.

### INTCOM.6 — End-to-end governed loop
A passive observation may inform context and strategy; strategy may propose a communication; only canonical policy/approval and ActionExecutor may authorize the communication; the resulting receipt returns as durable evidence.

## Invariants

- OBSERVATION != CONCLUSION.
- INTELLIGENCE != EXECUTION.
- COMMUNICATION INTENT != SEND AUTHORITY.
- TRANSPORT != POLICY.
- READ != WRITE.
- External providers never receive Jhadina governance authority.
- Activity is a projection of canonical durable evidence, not a second ledger.
- The PersonalCommandFeed remains the canonical home surface.

## Build order

1. Reconcile JH-042 as the already-landed INTCOM.1 foundation.
2. Define provider-neutral passive-observation contracts before implementing Shodan.
3. Add the Shodan read-only adapter behind those contracts.
4. Define communication intent, recipient/device identity and transport contracts.
5. Add durable communication receipts to the canonical evidence/activity path.
6. Add Reticulum as an adapter.
7. Verify the full observe -> reason -> propose -> govern -> communicate -> evidence loop.


## Handoff + GitHub-reference audit (2026-09-19)

This program was re-audited against the earlier Communications/Homebase handoff decisions and the current `bookieandco/crispy-waddle` implementation. The older handoff is stricter than the initial INTCOM document and is now authoritative where compatible with the canonical Jhadina spine.

### Preserved handoff requirements

- Communications is transport-agnostic: Identity -> Routing -> Encryption -> Policy -> Evidence. Reticulum is an adapter, never the authority layer.
- Model endpoint/recipient identity separately from transport-node, gateway, sensor/service and device identity. A reachable/discovered node is not automatically a trusted recipient.
- Preserve explicit trust states: discovered, reachable, identified, trusted and authorized. DISCOVERY != TRUST != AUTHORIZATION.
- Outbound work carries one correlation lineage across intent/proposal -> authorization -> transmission attempt -> acknowledgement/delivery -> durable evidence.
- Inbound transport payloads are untrusted observations. Normalize, authenticate where possible, deduplicate/replay-check, persist evidence, then route through governed context/intelligence. Inbound messages cannot invoke ActionExecutor directly.
- Encryption/authentication state, selected route/transport, acknowledgements, failures and delivery receipts are evidence.
- Store-and-forward/offline operation is a first-class transport property. Homebase may act as an always-on encrypted anchor/gateway and reconciliation point without becoming a second policy/execution authority.
- Device-local and Homebase/cloud state must remain reconcilable and idempotent; connectivity loss must not silently change authorization semantics.
- Internet/LAN/Bluetooth/LoRa/mesh/satellite-class links may be future transports behind the same registry/contracts. No transport-specific identity model may become canonical.
- Passive observation providers such as Shodan supply evidence only. Their observations cannot establish device trust, recipient authorization, or world-state truth by themselves.
- JANET/context may consume approved evidence; DELIA/intelligence may interpret it; MARISA-class work may prepare proposals. None receives independent send/execute authority.

### Current-repo findings

Current main has the canonical identity/policy/approval/ActionExecutor/audit spine and the JH-042 durable Activity projection. It does not currently contain the earlier proposed Communications Core, Transport Registry, Reticulum adapter, Homebase device registry, or offline sync-envelope implementation under those names. Therefore those handoff concepts must be reconstructed against current primitives rather than copied as a parallel stack.

The existing Activity projection remains the single read-side for canonical durable audit evidence. Communications and observation work must extend canonical evidence domains/contracts rather than introduce an in-memory or communications-specific authority ledger.

### Revised build sequence

1. INTCOM.2A — provider-neutral passive ObservationEnvelope with source/provenance/freshness/limitations and immutable evidence references.
2. INTCOM.2B — Shodan read-only adapter mapped into that envelope; no active scanning or trust inference.
3. INTCOM.3A — EndpointIdentity, TransportIdentity and TrustState contracts; discovered/reachable/identified/trusted/authorized remain distinct.
4. INTCOM.3B — CommunicationIntent + governed capability/action contract; recipient authorization occurs before transport selection/send.
5. INTCOM.3C — TransportRegistry + route capability/health metadata; registry selects eligible transport only after authorization and has no policy authority.
6. INTCOM.4A — DeliveryReceipt/Evidence lineage with correlation ID, transmission/ack/delivery/failure states.
7. INTCOM.4B — inbound normalization, authentication evidence, replay/dedup boundary and governed event ingestion.
8. INTCOM.5A — Homebase/offline store-and-forward adapter with idempotent reconciliation; no second execution authority.
9. INTCOM.5B — Reticulum adapter behind the same contracts.
10. INTCOM.6 — end-to-end verification: passive observation -> evidence -> context/intelligence -> proposal -> policy/approval -> communication -> receipt -> Activity/context.

### Explicit exclusions

Do not resurrect PR #16's parallel agent runtime, global audit store or hard-coded health claims. Do not let Reticulum raw objects leak into canonical contracts. Do not equate route discovery with identity or authorization. Do not allow inbound network traffic to execute actions directly. Do not make Homebase, a gateway, a transport adapter, JANET, DELIA, MARISA, or Shodan an alternate policy authority.
