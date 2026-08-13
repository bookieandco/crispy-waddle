import { artStyles } from "@/types/boutique";
import { getStyleEngine } from "@/lib/admin/stats";

export const metadata = { title: "Art Styles — PupsonStuff Admin" };

const ENGINE_STYLES: Record<string, string> = {
  OpenAI: "bg-honey-oak/15 text-honey-oak",
  Muapi: "bg-gold/20 text-bronze",
  Deterministic: "bg-greige/30 text-ink/70",
};

const ENGINE_NOTES: Record<string, string> = {
  OpenAI: "gpt-image-1 via lib/ai.ts — needs OPENAI_API_KEY",
  Muapi: "lib/muapi.ts, a second provider — needs MUAPI_API_KEY",
  Deterministic: "lib/ascii.ts, pixel math — no API key, no AI model",
};

export default function AdminArtStylesPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Art Styles</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        {artStyles.length} styles, read straight from types/boutique.ts.
        Each one routes through a different generation engine — see
        app/api/generate-preview/route.ts for the real branch this table
        mirrors.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-greige/40 bg-white/50">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-greige/40 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-4 py-3 font-medium">Style</th>
              <th className="px-4 py-3 font-medium">Engine</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-greige/30">
            {artStyles.map((s) => {
              const engine = getStyleEngine(s.id);
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-ink">{s.label}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ENGINE_STYLES[engine]}`}
                    >
                      {engine}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/60">{ENGINE_NOTES[engine]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
