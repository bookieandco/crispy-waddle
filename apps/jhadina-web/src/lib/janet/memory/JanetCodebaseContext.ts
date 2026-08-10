/**
 * Optional structural context adapter for Janet.
 *
 * This boundary is designed for a codebase-memory MCP-style backend: the
 * backend indexes symbols, routes, calls, imports, and data flow; Janet only
 * consumes verified structural facts. The MCP/server remains replaceable.
 */
export interface CodebaseSymbol {
  qualifiedName: string;
  kind: "function" | "method" | "class" | "route" | "module" | "file";
  path: string;
}

export interface CodebaseCallPath {
  from: string;
  to: string;
  relation: "calls" | "imports" | "http_calls" | "uses_type";
}

export interface JanetCodebaseContext {
  project: string;
  symbols: CodebaseSymbol[];
  paths: CodebaseCallPath[];
  generatedAt: string;
  source: "codebase-memory" | "repository-index";
}

export interface JanetCodebaseMemory {
  architecture(project?: string): Promise<JanetCodebaseContext>;
  search(query: string, limit?: number): Promise<CodebaseSymbol[]>;
  trace(functionName: string, direction: "inbound" | "outbound" | "both"): Promise<CodebaseCallPath[]>;
}
