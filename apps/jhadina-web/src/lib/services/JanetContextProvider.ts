import { MemoryRepository } from "../repositories/MemoryRepository"

export interface JanetCodebaseContext {
  summary: string
  relevantPaths: string[]
  relationships: string[]
}

export interface JanetContextBundle {
  approvedMemories: unknown[]
  sourceMemoryIds: string[]
  codebase: JanetCodebaseContext
}

export interface JanetCodebaseContextProvider {
  getContext(input: { userId: string; objective?: string }): Promise<JanetCodebaseContext>
}

/** Safe default used when no codebase index is available in the runtime. */
export class EmptyJanetCodebaseContextProvider implements JanetCodebaseContextProvider {
  async getContext(): Promise<JanetCodebaseContext> {
    return {
      summary: "No codebase index is currently attached to this JanetService instance.",
      relevantPaths: [],
      relationships: [],
    }
  }
}

export class JanetContextProvider {
  constructor(
    private readonly memoryRepo: MemoryRepository,
    private readonly codebaseProvider: JanetCodebaseContextProvider = new EmptyJanetCodebaseContextProvider(),
  ) {}

  async build(input: { userId: string; objective?: string }): Promise<JanetContextBundle> {
    const approvedMemories = await this.memoryRepo.getContext(input.userId)
    const codebase = await this.codebaseProvider.getContext(input)

    return {
      approvedMemories,
      sourceMemoryIds: approvedMemories.map((memory) => memory.id),
      codebase,
    }
  }
}
