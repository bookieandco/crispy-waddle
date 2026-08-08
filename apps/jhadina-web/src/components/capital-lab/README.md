# Capital Lab UI

Mobile-first Jhadina Capital Lab surface.

The component accepts a `CapitalLabSnapshot` supplied by the Money Core integration. It intentionally does not contain provider credentials or financial policy logic.

Current UI actions:

- Add Funds
- Send Funds
- Withdraw

Send/Withdraw automatically render unavailable while the connected provider reports those capabilities as disabled. The UI is therefore safe to mount against the current Coinbase read-only adapter.
