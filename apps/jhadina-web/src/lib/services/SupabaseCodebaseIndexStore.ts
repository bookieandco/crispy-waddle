import type { CodebaseIndexSnapshot, CodebaseIndexStore } from "./JanetCodebaseIndex"

export interface CodebaseIndexDb {
  from(table: string): any
}

/**
 * Supabase/Postgres-backed implementation of JANET's codebase graph store.
 * The DB client is injected so the service remains testable and deployment-neutral.
 */
export class SupabaseCodebaseIndexStore implements CodebaseIndexStore {
  constructor(private readonly db: CodebaseIndexDb) {}

  async get(key: string): Promise<CodebaseIndexSnapshot | null> {
    const [repository, ref] = key.split("@")
    const indexResult = await this.db
      .from("janet_codebase_indexes")
      .select("repository, git_ref, indexed_at, source_sha")
      .eq("repository", repository)
      .eq("git_ref", ref)
      .maybeSingle()
    if (indexResult.error || !indexResult.data) return null

    const nodesResult = await this.db
      .from("janet_codebase_nodes")
      .select("id, kind, name, path, symbol_kind, start_line, end_line")
      .eq("repository", repository)
      .eq("git_ref", ref)
    if (nodesResult.error) throw nodesResult.error

    const nodeIds = (nodesResult.data ?? []).map((node: any) => node.id)
    const edgesResult = nodeIds.length
      ? await this.db.from("janet_codebase_edges").select("from_id, to_id, kind").in("from_id", nodeIds)
      : { data: [], error: null }
    if (edgesResult.error) throw edgesResult.error

    return {
      repository,
      ref,
      indexedAt: indexResult.data.indexed_at,
      nodes: (nodesResult.data ?? []).map((node: any) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        path: node.path,
        symbolKind: node.symbol_kind ?? undefined,
        startLine: node.start_line ?? undefined,
        endLine: node.end_line ?? undefined,
      })),
      edges: (edgesResult.data ?? []).map((edge: any) => ({
        from: edge.from_id,
        to: edge.to_id,
        kind: edge.kind,
      })),
    }
  }

  async put(key: string, snapshot: CodebaseIndexSnapshot): Promise<void> {
    const repository = snapshot.repository
    const ref = snapshot.ref

    const indexResult = await this.db.from("janet_codebase_indexes").upsert({
      repository,
      git_ref: ref,
      indexed_at: snapshot.indexedAt,
    })
    if (indexResult.error) throw indexResult.error

    await this.db.from("janet_codebase_edges").delete().in("from_id", snapshot.nodes.map(n => n.id))
    await this.db.from("janet_codebase_nodes").delete().eq("repository", repository).eq("git_ref", ref)

    if (snapshot.nodes.length) {
      const nodesResult = await this.db.from("janet_codebase_nodes").insert(snapshot.nodes.map(node => ({
        id: node.id,
        repository,
        git_ref: ref,
        kind: node.kind,
        name: node.name,
        path: node.path,
        symbol_kind: node.symbolKind ?? null,
        start_line: node.startLine ?? null,
        end_line: node.endLine ?? null,
        indexed_at: snapshot.indexedAt,
      })))
      if (nodesResult.error) throw nodesResult.error
    }

    if (snapshot.edges.length) {
      const edgesResult = await this.db.from("janet_codebase_edges").insert(snapshot.edges.map(edge => ({
        from_id: edge.from,
        to_id: edge.to,
        kind: edge.kind,
      })))
      if (edgesResult.error) throw edgesResult.error
    }
  }
}
