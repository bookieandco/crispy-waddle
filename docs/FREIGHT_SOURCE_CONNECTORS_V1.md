# Freight Source Connectors v1

## Architecture

`DAT Adapter ─┐`
`Truckstop ───┼→ FreightSourceRegistry → Dispatcher acquisition/evaluation`
`Other API ───┘`

Provider-specific authentication, response shapes, retries, and health checks stay inside adapters. The Dispatcher receives only the normalized `FreightLoad` contract.

## Current implementations

- `DatFreightSourceAdapter`
- `TruckstopFreightSourceAdapter`

These adapters intentionally accept injected provider clients. No credentials, endpoints, scraping, or fabricated provider API behavior are embedded in the core.

## Boundary rules

1. Only authorized/legitimate provider APIs or clients may be supplied.
2. Provider data is normalized before entering Dispatcher economics.
3. Raw provider payloads are retained only as adapter output metadata where needed for traceability.
4. Source health is observable independently from load ranking.
5. Adapters discover loads; they do not select, negotiate, accept, book, or pay for loads.
6. The existing approval boundary remains authoritative for booking.
