import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL(
  "../../../supabase/migrations/20261007201500_social_weekly_privileged_execution.sql",
  import.meta.url,
));
const migration = readFileSync(migrationPath, "utf8");

const expectedFunctions = [
  "jhadina_social_weekly_prepare_proposal",
  "jhadina_growth_weekly_prepare_paid_campaign",
  "jhadina_social_consume_weekly_publication_delegation",
  "jhadina_social_weekly_enqueue_outbox",
  "jhadina_social_weekly_begin_outbox_attempt",
  "jhadina_social_weekly_complete_outbox",
  "jhadina_social_weekly_fail_outbox",
  "jhadina_growth_consume_weekly_paid_delegation",
  "jhadina_growth_weekly_enqueue_paid_campaign",
  "jhadina_growth_weekly_begin_paid_outbox_attempt",
  "jhadina_growth_weekly_resolve_paid_outbox",
] as const;

describe("weekly privileged migration source", () => {
  it("does not contain malformed lone dollar quotes", () => {
    expect(migration).not.toMatch(
      /^[ \t]*(?:as|do)[ \t]+\$[ \t]*$/m,
    );
    expect(migration).not.toMatch(
      /^[ \t]*\$;[ \t]*$/m,
    );
  });

  it("contains one complete body for every privileged function", () => {
    const declarations = [
      ...migration.matchAll(
        /create or replace function public\.([a-z0-9_]+)\s*\(/gi,
      ),
    ].map((match) => match[1]);

    expect(declarations).toHaveLength(expectedFunctions.length);
    expect(new Set(declarations).size).toBe(expectedFunctions.length);
    expect(new Set(declarations)).toEqual(new Set(expectedFunctions));

    expect((migration.match(/\bas \$\$/g) ?? []))
      .toHaveLength(expectedFunctions.length);
    expect((migration.match(/\n\$\$;/g) ?? []))
      .toHaveLength(expectedFunctions.length);
  });

  it("preserves the weekly approval and ambiguous-side-effect gates", () => {
    expect(migration).toContain(
      "and p.status in ('approved','active')",
    );
    expect(migration).toContain(
      "and a.action_fingerprint = p_action_fingerprint",
    );
    expect(migration).toContain(
      "'create_paused_campaign'",
    );
    expect(migration).toContain(
      "p_status not in ('delivered','failed','ambiguous')",
    );
    expect(migration).toContain(
      "and status = 'attempting'",
    );
    expect(migration).toContain(
      "p_currency !~ '^[A-Z]{3}$'",
    );
  });

  it("keeps privileged execution service-role-only", () => {
    for (const name of expectedFunctions) {
      expect(migration).toMatch(
        new RegExp(
          "grant execute on function public\\."
          + name
          + "[\\s\\S]*?to service_role;",
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          "revoke all on function public\\."
          + name
          + "[\\s\\S]*?from public, anon, authenticated;",
          "i",
        ),
      );
    }

    expect(migration).not.toMatch(
      /grant execute on function public\.jhadina_(?:social|growth)_weekly_[\s\S]*?to authenticated;/i,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.jhadina_(?:social|growth)_weekly_[\s\S]*?to anon;/i,
    );
  });
});
