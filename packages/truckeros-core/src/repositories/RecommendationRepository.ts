import type { PlaceCategorySlug, Recommendation } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface RecordRecommendationInput {
  driverId: string;
  placeId: string;
  runContext: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    category: PlaceCategorySlug | "all";
    rankScore: number;
  };
}

export interface RecommendationRepository {
  record(input: RecordRecommendationInput): Promise<Recommendation>;
}

export class InMemoryRecommendationRepository implements RecommendationRepository {
  constructor(private readonly store: InMemoryStore) {}

  async record(input: RecordRecommendationInput): Promise<Recommendation> {
    const recommendation: Recommendation = {
      id: this.store.nextId("rec"),
      driverId: input.driverId,
      placeId: input.placeId,
      runContext: input.runContext,
      generatedAt: new Date().toISOString(),
    };
    this.store.recommendations.set(recommendation.id, recommendation);
    return recommendation;
  }
}

export class PostgresRecommendationRepository implements RecommendationRepository {
  constructor(private readonly db: SqlClient) {}

  async record(input: RecordRecommendationInput): Promise<Recommendation> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query<{
      id: string;
      driver_id: string;
      place_id: string;
      run_context: RecordRecommendationInput["runContext"];
      generated_at: string;
    }>(
      `insert into truckeros_recommendations (id, driver_id, place_id, run_context)
       values ($1,$2,$3,$4::jsonb)
       returning *`,
      [id, input.driverId, input.placeId, JSON.stringify(input.runContext)]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      driverId: row.driver_id,
      placeId: row.place_id,
      runContext: row.run_context,
      generatedAt: row.generated_at,
    };
  }
}
