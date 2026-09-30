# Jhadina Cloud + Homebase Data Tiers

## Principle

Jhadina's canonical state must not depend on a single vendor. External cloud services are adapters/providers; Jhadina's own data model remains provider-neutral.

## Tiers

### Hot

Homebase NVMe/SSD contains active memories, frequently used knowledge, indexes, model runtimes, and working media.

### Durable

Jhadina Cloud and/or another encrypted object store contains canonical encrypted state, manifests, backups, and data required to rebuild a Homebase.

### External sources

iCloud and other user-authorized services are treated as source systems. They can be mirrored into the Homebase/Jhadina data vault without making the external service the canonical Jhadina database.

### Cold archive

Large, infrequently accessed media/model artifacts may be placed into lower-cost encrypted archive storage with manifests retained in the durable tier.

## Sync rules

- content-address large immutable objects where practical;
- use manifests for collections and model inventories;
- preserve provenance and timestamps;
- verify checksums after transfer;
- encrypt sensitive data before leaving the trust boundary;
- use idempotent operations;
- never silently overwrite conflicting canonical state;
- maintain a recoverable audit trail.

## iCloud

The iCloud connector may import authorized Photos/Drive/account data. `kei` is a candidate media mirroring implementation because it supports resumable, checksum-verified local iCloud Photos copies. `icloudpy` is a candidate general iCloud adapter but requires careful credential/session handling and compatibility testing.

## LocalSend

LocalSend is a local-network transport optimization. It can move large files directly between devices without an Internet service, but Homebase must still authenticate the peer and verify hashes before ingesting data.

## Model storage

Do not blindly replicate every model to every device. Store model manifests and capability metadata centrally, keep selected models hot on Homebase, and download additional artifacts on demand. Local inference remains available when disconnected.
