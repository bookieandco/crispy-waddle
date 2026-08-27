# Jhadina Homebase Node

The Homebase Node is Jhadina's persistent, reachable anchor. It is not a replacement for local intelligence; it is a durable coordination and synchronization point.

## Responsibilities

- persistent encrypted Jhadina state;
- local model/runtime hosting where hardware permits;
- Memory Core and local retrieval services;
- device registration and revocation;
- authenticated synchronization;
- durable offline queue ingestion;
- connectivity monitoring and multi-WAN orchestration;
- optional cloud-model gateway when Internet is available;
- backups and recovery metadata.

## Network model

A device may reach Homebase over any authorized transport: home Wi-Fi, public Wi-Fi, cellular, Starlink, another authorized satellite/NTN link, or a future private/mesh transport. The application layer should not depend on a specific transport.

## Security boundary

Device registration must use authenticated public-key identity. Revoked devices must not be able to synchronize. Synchronization envelopes require stable idempotency keys so reconnect/retry cannot duplicate state changes.

Do not expose Homebase administrative services directly to the public Internet. Use a mutually authenticated overlay/tunnel or another explicitly authorized secure access mechanism.

## Availability model

Homebase A is the initial anchor. The architecture must permit Homebase B/C in geographically separate locations later. Devices should tolerate temporary loss of every Homebase by retaining local state and queued work.

## Desired lifecycle

DEVICE ONLINE -> HOMEBASE SYNC -> LOCAL OPERATION -> NETWORK LOSS -> LOCAL QUEUE -> RECONNECT -> AUTHENTICATE -> RECONCILE -> ACKNOWLEDGE

The Homebase is therefore an availability multiplier, not a single point of failure.
