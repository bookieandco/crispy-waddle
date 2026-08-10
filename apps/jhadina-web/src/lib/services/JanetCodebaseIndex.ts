export type CodebaseNode = {
  id: string
  kind: "file" | "symbol"
  name: string
  path: string
  symbolKind?: string
  startLine?: number
  endLine?: number
}

export type CodebaseEdge = {
  from: string
  to: string
  kind: "imports" | "exports" | "references"
}

export type CodebaseIndexSnapshot = {
  repository: string
  ref: string
  indexedAt: string
  nodes: CodebaseNode[]
  edges: CodebaseEdge[]
}

export interface CodebaseIndexStore {
  get(key: string): Promise<CodebaseIndexSnapshot | null>
  put(key: string, snapshot: CodebaseIndexSnapshot): Promise<void>
}

/** Runtime-persistent store. Replace with Supabase/Postgres without changing JANET's query API. */
export class RuntimeCodebaseIndexStore implements CodebaseIndexStore {
  private readonly snapshots = new Map<string, CodebaseIndexSnapshot>()

  async get(key: string) {
    return this.snapshots.get(key) ?? null
  }

  async put(key: string, snapshot: CodebaseIndexSnapshot) {
    this.snapshots.set(key, snapshot)
  }
}

export class JanetCodebaseIndex {
  constructor(private readonly store: CodebaseIndexStore) {}

  async save(snapshot: CodebaseIndexSnapshot) {
    await this.store.put(`${snapshot.repository}@${snapshot.ref}`, snapshot)
  }

  async load(repository: string, ref: string) {
    return this.store.get(`${repository}@${ref}`)
  }

  async search(repository: string, ref: string, query: string, limit = 20) {
    const snapshot = await this.load(repository, ref)
    if (!snapshot) return []
    const q = query.toLowerCase().trim()
    return snapshot.nodes
      .map(node => ({ node, score: [node.name, node.path].join(" ").toLowerCase().includes(q) ? 1 : 0 }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.node)
  }

  async related(repository: string, ref: string, nodeId: string) {
    const snapshot = await this.load(repository, ref)
    if (!snapshot) return []
    const ids = new Set<string>()
    for (const edge of snapshot.edges) {
      if (edge.from === nodeId) ids.add(edge.to)
      if (edge.to === nodeId) ids.add(edge.from)
    }
    return snapshot.nodes.filter(node => ids.has(node.id))
  }

  async callPath(repository: string, ref: string, from: string, to: string, maxDepth = 8) {
    const snapshot = await this.load(repository, ref)
    if (!snapshot) return []
    const adjacency = new Map<string, string[]>()
    for (const edge of snapshot.edges) {
      const list = adjacency.get(edge.from) ?? []
      list.push(edge.to)
      adjacency.set(edge.from, list)
    }
    const queue: string[][] = [[from]]
    const seen = new Set([from])
    while (queue.length) {
      const path = queue.shift()!
      const current = path[path.length - 1]
      if (current === to) return path
      if (path.length > maxDepth) continue
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push([...path, next])
        }
      }
    }
    return []
  }
}
