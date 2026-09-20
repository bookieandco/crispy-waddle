# REF-PROV-02 Repository Inventory

This inventory summarizes the registry state produced by REF-PROV-02. The
runtime registry remains the machine-readable source of truth.

| Subsystem | Traceable references added | Remaining debt |
| --- | --- | --- |
| Money | Plaid | upstream/version metadata |
| Commerce | Stripe | documentation/version pinning |
| Intelligence | Anthropic, Shodan, Reticulum | Reticulum upstream/license verification |
| SHARK | DexScreener, CoinGecko, Helius | Pump docs, Meteora-Rug-Bot, wallet-cluster-detector handoff provenance |
| Opportunity | SAM.gov | API version/change tracking |
| Media/Director | ComfyUI, SAM2 | upstream URL/license/version verification |
| Platform | Supabase | upstream/license/version verification |
| PupsonStuff | Godot, Turbulenz | license/revision verification before any code-derivation claim |
| Music | VoiceFixer, Sony identity models, NeuralNote, CHOW Tape Model, DawDreamer, FFmpeg, ACE-Step, MuseScore | exact upstream/revision/license plus real adapter status |
| Justice | statedecoded, citation-regexes, statedb | exact upstream/revision/license and live-provider decisions |
| Sports | none promoted from handoff | MDP-Adaptive-GA, SelfAware, Coach-RL, alpha-beta-CROWN |
| Knowledge | none promoted from handoff | GPT Researcher, deep-research, policy-gate |

## Hard audit rule

A matching subject name is not enough to establish provenance.

Examples:

- Meteora code does not prove derivation from Meteora-Rug-Bot.
- A local policy gateway does not prove derivation from policy-gate.
- An adaptive sports algorithm does not prove use of MDP-Adaptive-GA.

Only exact evidence can upgrade those relationships.
