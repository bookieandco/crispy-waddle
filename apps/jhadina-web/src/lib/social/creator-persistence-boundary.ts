/** Source-only until live schema, owner isolation and device acceptance are proven.
 * Intentionally no environment/header/body override or public enabling switch.
 * API denial is independent of UI controls and database availability.
 */
export const CREATOR_PERSISTENCE_COMMISSIONED = false

export function assertCreatorPersistenceCommissioned(): void {
  throw new Error('SOCIAL_FREE_NOT_COMMISSIONED')
}
