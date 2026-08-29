export type SharkEntityType =
  | 'token'
  | 'pool'
  | 'wallet'
  | 'wallet_cluster'
  | 'creator'
  | 'social_identity'
  | 'transaction'
  | 'exchange'
  | 'mining_operation';

export type SharkRelationType =
  | 'created'
  | 'funded'
  | 'owns'
  | 'traded'
  | 'provided_liquidity'
  | 'removed_liquidity'
  | 'transferred_to'
  | 'associated_with'
  | 'promoted'
  | 'mines'
  | 'deployed'
  | 'interacted_with';

export interface SharkEntity {
  readonly id: string;
  readonly type: SharkEntityType;
  readonly chain?: string;
  readonly address?: string;
  readonly label?: string;
  readonly firstSeenAt?: string;
  readonly lastSeenAt?: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface SharkRelation {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly type: SharkRelationType;
  readonly observedAt: string;
  readonly confidence: number;
  readonly evidenceIds: readonly string[];
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface SharkEntityGraph {
  readonly entities: readonly SharkEntity[];
  readonly relations: readonly SharkRelation[];
}

/**
 * Relationship strength is intentionally separate from decision score.
 * SHARK should understand connections before deciding what they mean.
 */
export function relationIsMaterial(relation: SharkRelation): boolean {
  return relation.confidence >= 0.75 && relation.evidenceIds.length > 0;
}
