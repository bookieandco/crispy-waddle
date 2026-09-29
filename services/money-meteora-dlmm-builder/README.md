# Money Meteora DLMM Builder

Private transaction-construction service for the Money DEX router. It uses the official `@meteora-ag/dlmm` SDK to quote a named mainnet DLMM pool and build one unsigned v0 transaction.

It never stores or receives a private key, seed phrase, signer token, or signed transaction. Money sends the pool, mint pair, exact input, minimum output, slippage bound, public Coffer address, and execution ID. Signing remains in the separate Coffer signer.

Required environment:

- `SOLANA_RPC_URL` — HTTPS server-side Solana RPC
- `MONEY_METEORA_BUILDER_AUTH` — opaque authorization header expected verbatim
- `PORT` — optional, defaults to 8092

The service rejects partial fills and a quote whose SDK minimum output is below Money's already-approved minimum.
