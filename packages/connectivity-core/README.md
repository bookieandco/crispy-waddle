# @jhadina/connectivity-core

Transport-agnostic connectivity and offline-intelligence contracts for Jhadina.

The package deliberately separates:

- connectivity health from application logic;
- authorized network discovery from access-control bypass;
- local intelligence from remote model escalation;
- offline work from eventual synchronization.

This is the foundation for an always-available Jhadina experience across Wi-Fi, Ethernet, cellular, Starlink, and future authorized satellite/NTN adapters.
