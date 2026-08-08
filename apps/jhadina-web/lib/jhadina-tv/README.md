# JhadinaTV

JhadinaTV is the media/TV plugin boundary for Jhadina.

## Current foundation

- Protocol-independent playback device contracts
- Device discovery/connection manager
- TV session state
- Provenance-aware source registry
- Home-screen view model
- Device-picker view model

## Transport policy

Bluetooth is treated as a device-control transport where supported. It is **not** assumed to be a universal video transport. Video playback should use an appropriate supported transport such as Google Cast, AirPlay, DLNA, or a native TV adapter.

## Next layers

1. Web UI route and device picker
2. Browser-safe adapters
3. HTML5 playback/session synchronization
4. IPTV/EPG ingestion
5. Metadata enrichment
6. Jhadina watch-memory and recommendations
