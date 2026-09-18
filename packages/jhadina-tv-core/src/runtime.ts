import type { CatalogRegistry } from './catalog';
import type { AskJhadinaMediaPort, MediaKnowledge, MediaRecommendationContext, MediaRecommendationExplanation } from './media-intelligence';
import type { MediaTitle, ViewingSignal } from './index';

export interface JhadinaMediaContextPort {
  getViewingSignals(): Promise<readonly ViewingSignal[]>;
  getMediaKnowledge(): Promise<readonly MediaKnowledge[]>;
}

export interface JhadinaTVRuntime {
  search(query: string): Promise<MediaTitle[]>;
  ask(query: string): Promise<MediaRecommendationExplanation[]>;
}

export function createJhadinaTVRuntime(registry: CatalogRegistry, advisor: AskJhadinaMediaPort, context: JhadinaMediaContextPort): JhadinaTVRuntime {
  return {
    async search(query) {
      return (await registry.search({ query })).map(({ providerId, title }) => ({ ...title, providerId }));
    },
    async ask(query) {
      const catalog = await this.search('');
      const recommendationContext: MediaRecommendationContext = {
        query,
        signals: await context.getViewingSignals(),
        knowledge: await context.getMediaKnowledge(),
      };
      return advisor.recommend(recommendationContext, catalog);
    },
  };
}
