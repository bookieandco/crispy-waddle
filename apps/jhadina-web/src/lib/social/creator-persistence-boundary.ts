/** SOCIAL-FREE-FINAL.05: owner-authenticated draft persistence commissioned
 * only after live Jhadina RLS checks. This grants no external marketing authority.
 * POST/PATCH/import remain subject to canonical auth, same-origin requests,
 * Supabase RLS, immutable owner and zero-action record constraints.
 */
export const CREATOR_PERSISTENCE_COMMISSIONED = true as const;

export function assertCreatorPersistenceCommissioned(): void {
 if (!CREATOR_PERSISTENCE_COMMISSIONED) throw Error('SOCIAL_FREE_NOT_COMMISSIONED');
}
