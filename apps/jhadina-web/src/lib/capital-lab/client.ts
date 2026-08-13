import type { CapitalLabSnapshot } from "@/components/capital-lab/CapitalLabPanel";

const MONEY_CORE_URL = process.env.MONEY_CORE_URL;

export async function getCapitalLabSnapshot(): Promise<CapitalLabSnapshot> {
  if (!MONEY_CORE_URL) {
    throw new Error("MONEY_CORE_URL is not configured");
  }

  const response = await fetch(`${MONEY_CORE_URL.replace(/\/$/, "")}/capital-lab/snapshot`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Money Core snapshot failed (${response.status})`);
  }

  return (await response.json()) as CapitalLabSnapshot;
}
