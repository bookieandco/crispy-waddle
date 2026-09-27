# JHADINA-ONE-RUNTIME.4 — runtime projection and cross-domain lineage

## Runtime projection

The WorkSession task graph now has a compact read-only projection for Ask Jhadina and the future Command Center.

It reports:

- total tasks;
- automatically progressing tasks;
- human-attention count;
- terminal count;
- counts by status;
- counts by domain;
- bounded recent task summaries;
- the existing `what needs me?` attention projection.

The summary intentionally excludes task authority references, input payloads and other internals that should not become UI coupling.

## Cross-domain lineage

ONE-RUNTIME does not create a second asset/product/order/revenue database.

Instead, `WorkSessionLineageNode` points at canonical records owned by their real subsystems.

Supported reference kinds include:

- task;
- artifact;
- product;
- campaign;
- publication;
- order;
- revenue;
- opportunity;
- contract;
- position;
- bet;
- evidence;
- other.

Edges describe how records relate, for example:

```text
Director artifact
  -> PupsonStuff product
  -> Growth campaign
  -> Commerce order
  -> Money revenue
```

The graph stores only references, hashes/evidence where available, and relationship edges. Every edge has `REFERENCE_ONLY` authority.

## Invariants

- canonical source refs are unique within owner + WorkSession + domain;
- cross-owner edges fail closed;
- self-edges fail closed;
- directional lineage cycles fail closed;
- linked-to edges may be non-hierarchical;
- traversal is bounded;
- the graph cannot mutate the referenced subsystem record;
- lineage never authorizes execution.

This gives Jhadina enough shared context to answer future questions such as:

> Which video produced this product?
> Which ad sold this product?
> What revenue came from this episode?
> Which generated asset is this campaign actually using?

without collapsing Director, PupsonStuff, Growth, Commerce and Money into one database.
