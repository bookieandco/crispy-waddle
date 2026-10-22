"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

type FeeQuote = {
  tier: string
  percentFeeBps: number
  percentFeeRaw: string
  flatFeeLamportsPerHop: number
  totalFlatFeeLamports: number
  isTestMode: true
  authority: "READ_ONLY_OBSERVATION"
  canMoveFunds: false
}
type QuoteResponse = { success: true; data: FeeQuote } | { success: false; error: string }

const sampleSolMint = "So11111111111111111111111111111111111111112"

export default function AgentPayDevnetPage() {
  const [tokenMint, setTokenMint] = useState(sampleSolMint)
  const [amountRaw, setAmountRaw] = useState("1000000000")
  const [tokenDecimals, setTokenDecimals] = useState("9")
  const [hops, setHops] = useState("7")
  const [quote, setQuote] = useState<FeeQuote | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const requestQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuote(null)
    setError("")
    setLoading(true)
    try {
      const response = await fetch("/api/money/agentpay/quote", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenMint, amountRaw, tokenDecimals: Number(tokenDecimals), hops: Number(hops) }),
      })
      const result = await response.json() as QuoteResponse
      if (!response.ok || !result.success) {
        setError(result.success ? "Quote unavailable." : result.error)
        return
      }
      setQuote(result.data)
    } catch {
      setError("Quote service is unreachable.")
    } finally {
      setLoading(false)
    }
  }

  const field = { width: "100%", padding: "12px", background: "#171c27", color: "#f4f6fb", border: "1px solid #485368", borderRadius: 10 }
  return <main style={{ minHeight: "100vh", color: "#f4f6fb", background: "#0d121d", padding: "24px 16px" }}>
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <nav style={{ display: "flex", gap: 14, fontSize: 14, marginBottom: 24 }}>
        <Link href="/money/command-center" style={{ color: "#d6b98c" }}>← Money Core</Link>
        <Link href="/wallet" style={{ color: "#d6b98c" }}>Wallet connections</Link>
      </nav>
      <div style={{ fontSize: 12, letterSpacing: 2, color: "#d6b98c" }}>JHADINA / AGENTPAY</div>
      <h1 style={{ fontSize: 30, lineHeight: 1.2, margin: "10px 0" }}>Devnet route quote</h1>
      <p style={{ color: "#b8c2d4", lineHeight: 1.6 }}>Estimate MultiHopper routing costs with a test key. This screen cannot send tokens, sign with Phantom, create transfers or earn bounty volume.</p>
      <div role="status" style={{ margin: "18px 0", background: "#272338", border: "1px solid #685680", padding: 14, borderRadius: 12 }}>
        <strong>Simulation only.</strong> No mainnet money or wallet signing is enabled.
      </div>
      <form onSubmit={requestQuote} style={{ display: "grid", gap: 16, padding: 20, background: "#171c27", borderRadius: 16 }}>
        <label>Solana token mint
          <input aria-label="Token mint" required value={tokenMint} onChange={e => setTokenMint(e.target.value)} style={field} />
        </label>
        <label>Amount in atomic units
          <input aria-label="Atomic token amount" required inputMode="numeric" value={amountRaw} onChange={e => setAmountRaw(e.target.value)} style={field} />
        </label>
        <label>Token decimals
          <input aria-label="Token decimals" required type="number" min={0} max={18} value={tokenDecimals} onChange={e => setTokenDecimals(e.target.value)} style={field} />
        </label>
        <label>Routing hops (3–10)
          <input aria-label="Routing hops" required type="number" min={3} max={10} value={hops} onChange={e => setHops(e.target.value)} style={field} />
        </label>
        <button type="submit" disabled={loading} style={{ border: "none", background: "#d6b98c", color: "#171c27", fontWeight: 700, padding: 14, borderRadius: 10, cursor: "pointer" }}>
          {loading ? "Checking devnet…" : "Get test fee estimate"}
        </button>
      </form>
      {error && <p role="alert" style={{ color: "#ffb7b7", marginTop: 18 }}>{error}</p>}
      {quote && <section aria-live="polite" style={{ marginTop: 20, border: "1px solid #485368", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 19 }}>MultiHopper test estimate</h2>
        <p>Pricing tier: <strong>{quote.tier}</strong></p>
        <p>Percentage fee: <strong>{quote.percentFeeBps} basis points</strong> ({quote.percentFeeRaw} token atomic units)</p>
        <p>Flat hop fees: <strong>{quote.totalFlatFeeLamports.toLocaleString()} lamports</strong> total</p>
        <p style={{ color: "#b8c2d4" }}>Test-mode quote only. Not a payment authorization or final production quote.</p>
      </section>}
    </div>
  </main>
}
