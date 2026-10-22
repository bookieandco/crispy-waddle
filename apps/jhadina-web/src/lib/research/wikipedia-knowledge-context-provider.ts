import type { KnowledgeContextProvider } from "../context/context-builder"
import {
  createWikipediaResearchClient,
  extractWikipediaQuery,
  wikipediaToEvidence,
  type WikipediaResearch,
} from "./wikipedia-research-provider"

/**
 * Adds read-only public encyclopedia evidence to the existing K-1.5 Knowledge
 * provider. The canonical provider still owns its records, scores, and writes.
 * An unavailable public provider cannot interrupt a user's Ask session.
 */
const defaultWikipediaResearch = createWikipediaResearchClient()

export function createWikipediaAugmentedKnowledgeContextProvider(
  canonical: KnowledgeContextProvider,
  wikipedia: WikipediaResearch = defaultWikipediaResearch,
  onResearch?: (result: Awaited<ReturnType<WikipediaResearch>>) => void,
): KnowledgeContextProvider {
  return {
    async getContext(input) {
      const query = extractWikipediaQuery(input.activeTask)
      if (!query) return canonical.getContext(input)

      const [internal, external] = await Promise.allSettled([
        canonical.getContext(input),
        wikipedia(query),
      ])
      const canonicalContext = internal.status === "fulfilled"
        ? internal.value
        : { knowledge: [], limitations: ["canonical Knowledge runtime unavailable; not silently replaced with encyclopedia evidence"] }
      if (external.status === "fulfilled") onResearch?.(external.value)
      const wikipediaContext = external.status === "fulfilled"
        ? wikipediaToEvidence(external.value)
        : { knowledge: [], limitations: ["Wikipedia lookup failed; no public evidence returned"] }

      const byId = new Map<string, (typeof canonicalContext.knowledge)[number]>()
      // Prepend a bounded, explicitly unverified public excerpt so Context Builder's
      // character budget can surface citations rather than silently truncate all of them.
      for (const ref of [...wikipediaContext.knowledge, ...canonicalContext.knowledge]) {
        if (!byId.has(ref.id)) byId.set(ref.id, ref)
      }
      return {
        knowledge: [...byId.values()],
        limitations: [...new Set([...canonicalContext.limitations, ...wikipediaContext.limitations])],
      }
    },
  }
}
