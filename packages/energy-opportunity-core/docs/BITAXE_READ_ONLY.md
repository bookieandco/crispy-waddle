# Bitaxe/AxeOS read-only telemetry

The Bitaxe adapter is deliberately observation-only.

## Source contract

The adapter reads AxeOS `GET /api/system/info`, matching the ESP-Miner OpenAPI contract. The upstream ESP-Miner project identifies this as the system information endpoint and exposes telemetry including hashrate, power, temperatures, fan speed, frequency, shares, pool configuration, uptime, and network difficulty.

## Safety boundary

The adapter:

- performs GET-only telemetry reads;
- never calls settings, restart, pool-update, or other control endpoints;
- never stores or forwards pool passwords;
- strips credentials from the configured base URL;
- returns normalized telemetry to the Energy Opportunity Core;
- does not start, stop, throttle, or reconfigure a miner.

Real control requires a separate adapter, explicit Safeguard authorization, audit events, limits, and an emergency-stop path.

## Future discovery

A future LAN discovery service may identify Bitaxe devices, but discovery must remain separate from control. A discovered device enters `observe` mode until explicitly registered and authorized.
