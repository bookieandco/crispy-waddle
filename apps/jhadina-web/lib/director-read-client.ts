import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseStoryboardClient } from '@jhadina/director-core/storyboard-persistence';

type Filter = ReturnType<ReturnType<SupabaseStoryboardClient['from']>['select']>;

/** Keep SDK generics at the app boundary and expose only Director's read operations. */
export function createDirectorReadClient(client: SupabaseClient): SupabaseStoryboardClient {
  return {
    from(table) {
      return {
        select(columns) {
          let query = client.from(table).select(columns);
          const filter: Filter = {
            eq(column, value) { query = query.eq(column, value); return filter; },
            order(column, options) { query = query.order(column, options); return filter; },
            limit(count) { query = query.limit(count); return filter; },
            async maybeSingle() {
              const { data, error } = await query.maybeSingle();
              return { data, error };
            },
          };
          return filter;
        },
      };
    },
  };
}
