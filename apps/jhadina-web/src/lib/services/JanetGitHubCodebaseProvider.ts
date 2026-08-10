import { JanetCodebaseContext, JanetCodebaseContextProvider } from "./JanetContextProvider"

type TreeItem = { path?: string; type?: string; sha?: string }
type Content = { content?: string; encoding?: string }

/**
 * Live codebase adapter inspired by codebase-memory-mcp's graph approach.
 * It builds a lightweight, query-focused graph from the repository tree and
 * source text without pretending to be a full compiler/parser.
 */
export class JanetGitHubCodebaseProvider implements JanetCodebaseContextProvider {
  constructor(
    private readonly config: {
      owner: string
      repo: string
      ref: string
      token?: string
      maxFiles?: number
      maxFileBytes?: number
    },
  ) {}

  async getContext(input: { userId: string; objective?: string }): Promise<JanetCodebaseContext> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" }
    if (this.config.token) headers.Authorization = `Bearer ${this.config.token}`

    const tree = await this.request<TreeItem[]>(
      `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/trees/${encodeURIComponent(this.config.ref)}?recursive=1`,
      headers,
    )

    const sourceFiles = tree.filter((x) => x.type === "blob" && /\.(ts|tsx|js|jsx|py|json)$/.test(x.path || ""))
      .filter((x) => !/(node_modules|\.next|dist|build|coverage)\//.test(x.path || ""))
      .slice(0, this.config.maxFiles ?? 180)

    const objectiveTokens = this.tokens(input.objective || "")
    const ranked = sourceFiles.map((item) => ({ item, score: this.scorePath(item.path || "", objectiveTokens) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)

    const nodes: string[] = []
    const relationships: string[] = []
    const relevantPaths = ranked.map(({ item }) => item.path!).filter(Boolean)

    for (const { item } of ranked.slice(0, 16)) {
      const path = item.path!
      const content = await this.file(path, headers)
      if (!content) continue
      nodes.push(...this.extractSymbols(path, content))
      relationships.push(...this.extractRelationships(path, content))
    }

    return {
      summary: `GitHub codebase graph for ${this.config.owner}/${this.config.repo}@${this.config.ref}. ${relevantPaths.length} relevant source paths selected for objective${input.objective ? `: ${input.objective}` : ""}.`,
      relevantPaths,
      relationships: [...new Set([...nodes, ...relationships])].slice(0, 160),
    }
  }

  private async file(path: string, headers: Record<string, string>): Promise<string> {
    try {
      const data = await this.request<Content>(`https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${encodeURIComponent(this.config.ref)}`, headers)
      if (data.encoding !== "base64" || !data.content) return ""
      const text = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8")
      return text.slice(0, this.config.maxFileBytes ?? 120_000)
    } catch { return "" }
  }

  private async request<T>(url: string, headers: Record<string, string>): Promise<T> {
    const response = await fetch(url, { headers, cache: "no-store" })
    if (!response.ok) throw new Error(`GitHub codebase request failed: ${response.status}`)
    return response.json() as Promise<T>
  }

  private tokens(text: string): string[] {
    return [...new Set(text.toLowerCase().split(/[^a-z0-9_@/-]+/).filter((x) => x.length > 2))]
  }

  private scorePath(path: string, tokens: string[]): number {
    const lower = path.toLowerCase()
    return tokens.reduce((score, token) => score + (lower.includes(token) ? 4 : 0), 0) + (lower.includes("jhadina") ? 1 : 0)
  }

  private extractSymbols(path: string, content: string): string[] {
    const out: string[] = []
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
      /(?:export\s+)?class\s+([A-Za-z0-9_]+)/g,
      /(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g,
      /(?:export\s+)?type\s+([A-Za-z0-9_]+)/g,
      /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=/g,
    ]
    for (const pattern of patterns) for (const match of content.matchAll(pattern)) out.push(`${path}::${match[1]}`)
    return out
  }

  private extractRelationships(path: string, content: string): string[] {
    const out: string[] = []
    for (const match of content.matchAll(/(?:from\s+["']([^"']+)["']|import\s+["']([^"']+)["'])/g)) {
      out.push(`${path} -> imports -> ${match[1] || match[2]}`)
    }
    for (const match of content.matchAll(/(?:fetch\(|axios\.(?:get|post|put|patch|delete)\()\s*["']([^"']+)/g)) {
      out.push(`${path} -> calls -> ${match[1]}`)
    }
    return out
  }
}
