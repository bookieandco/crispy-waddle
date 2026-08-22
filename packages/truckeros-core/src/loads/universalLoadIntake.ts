export type LoadSourceType = "manual" | "csv" | "api";

export interface LoadOffer {
  id: string;
  origin: string;
  destination: string;
  grossPay: number;
  loadedMiles: number;
  deadheadMiles: number;
  equipment?: string;
  pickupAt?: string;
  deliveryAt?: string;
  source: {
    type: LoadSourceType;
    provider: string;
    externalId?: string;
    importedAt: string;
  };
}

export interface LoadIntakeResult {
  load: LoadOffer;
  warnings: string[];
}

const money = /(?:\$|usd\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)/i;
const miles = /([0-9][0-9,]*(?:\.\d+)?)\s*(?:mi|miles)\b/i;

function numberValue(value: string): number {
  return Number(value.replace(/,/g, ""));
}

export function parseLoadText(text: string, now = new Date()): LoadIntakeResult {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) throw new Error("LOAD_TEXT_EMPTY");

  const route = cleaned.match(/([^,]+?)\s*(?:->|→|to)\s*([^,$]+?)(?=,|\s+\$|\s+\d)/i);
  if (!route) throw new Error("LOAD_ROUTE_NOT_FOUND");

  const payMatch = cleaned.match(money);
  if (!payMatch) throw new Error("LOAD_GROSS_PAY_NOT_FOUND");

  const milesMatch = cleaned.match(miles);
  if (!milesMatch) throw new Error("LOAD_MILES_NOT_FOUND");

  const warnings: string[] = [];
  const grossPay = numberValue(payMatch[1]);
  const loadedMiles = numberValue(milesMatch[1]);

  if (grossPay <= 0) warnings.push("Gross pay is not positive.");
  if (loadedMiles <= 0) warnings.push("Loaded miles are not positive.");

  return {
    load: {
      id: `manual_${now.getTime()}`,
      origin: route[1].trim(),
      destination: route[2].trim(),
      grossPay,
      loadedMiles,
      deadheadMiles: 0,
      source: {
        type: "manual",
        provider: "manual_text",
        importedAt: now.toISOString(),
      },
    },
    warnings,
  };
}

export function parseLoadCsvRow(
  row: Record<string, string>,
  now = new Date(),
): LoadIntakeResult {
  const value = (key: string) => row[key]?.trim() ?? "";
  const origin = value("origin");
  const destination = value("destination");
  const grossPay = numberValue(value("grossPay"));
  const loadedMiles = numberValue(value("loadedMiles"));
  const deadheadMiles = numberValue(value("deadheadMiles") || "0");

  if (!origin || !destination) throw new Error("CSV_ROUTE_REQUIRED");
  if (!Number.isFinite(grossPay) || grossPay <= 0) throw new Error("CSV_GROSS_PAY_INVALID");
  if (!Number.isFinite(loadedMiles) || loadedMiles <= 0) throw new Error("CSV_LOADED_MILES_INVALID");
  if (!Number.isFinite(deadheadMiles) || deadheadMiles < 0) throw new Error("CSV_DEADHEAD_INVALID");

  return {
    load: {
      id: value("id") || `csv_${now.getTime()}`,
      origin,
      destination,
      grossPay,
      loadedMiles,
      deadheadMiles,
      equipment: value("equipment") || undefined,
      pickupAt: value("pickupAt") || undefined,
      deliveryAt: value("deliveryAt") || undefined,
      source: {
        type: "csv",
        provider: value("provider") || "csv_import",
        externalId: value("externalId") || undefined,
        importedAt: now.toISOString(),
      },
    },
    warnings: [],
  };
}
