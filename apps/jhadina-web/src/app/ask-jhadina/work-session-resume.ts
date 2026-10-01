export type SessionPointerStorage = Pick<Storage, "getItem" | "setItem">

export function workSessionPointerKey(ownerUserId: string): string {
  return `jhadina:work-session:${ownerUserId}`
}

function readPointer(storage: SessionPointerStorage | undefined, key: string): string {
  try { return storage?.getItem(key)?.trim() ?? "" } catch { return "" }
}

export function rememberWorkSession(storage: SessionPointerStorage | undefined, ownerUserId: string, id: string): void {
  // Browser storage is only a convenience pointer; server persistence remains authoritative.
  try { storage?.setItem(workSessionPointerKey(ownerUserId), id) } catch { /* private/blocked storage */ }
}

export async function resumeOwnerWorkSession(input: {
  ownerUserId: string
  requestedSessionId?: string | null
  storage?: SessionPointerStorage
  fetchSession: (id: string) => Promise<unknown | null>
  createId: () => string
}): Promise<{ id: string; session: unknown | null; unavailable: boolean }> {
  const candidate = input.requestedSessionId?.trim()
    || readPointer(input.storage, workSessionPointerKey(input.ownerUserId))
    || readPointer(input.storage, "jhadina:work-session")
  if (candidate) {
    // Errors must propagate: a temporary outage is not proof that the old session is gone.
    const session = await input.fetchSession(candidate)
    if (session !== null) {
      const value = session && typeof session === "object" ? session as Record<string, unknown> : {}
      if (value.id === candidate && value.ownerUserId === input.ownerUserId) {
        rememberWorkSession(input.storage, input.ownerUserId, candidate)
        return { id: candidate, session, unavailable: false }
      }
      throw new Error("WORK_SESSION_RESTORE_UNVERIFIED")
    }
  }
  // Never reuse an inaccessible/stale ID for a new write, even when supplied in a URL.
  // New IDs are remembered only after a server-confirmed save.
  return { id: input.createId(), session: null, unavailable: Boolean(candidate) }
}
