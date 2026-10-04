export type ProductTruthField =
  | "brand"
  | "model"
  | "size"
  | "color"
  | "material"
  | "quantity"
  | "included_accessories"
  | "compatibility"
  | "safety"
  | "installation"
  | "performance"
  | "label_text"
  | "other";

export interface ProductTruthAssertion {
  field: ProductTruthField;
  key: string;
  value: string;
  sourceRef: string;
  evidenceIds: readonly string[];
}

export interface ProductTruthLock {
  id: string;
  productId: string;
  version: number;
  assertions: readonly ProductTruthAssertion[];
  referenceAssetIds: readonly string[];
  evidenceIds: readonly string[];
  lockedAt: string;
  authority: "DIRECTOR_PRODUCT_TRUTH_LOCK";
}

export interface ProductCreativeRepresentation {
  field: ProductTruthField;
  key: string;
  value: string;
  evidenceIds?: readonly string[];
}

export interface ProductTruthEvaluation {
  admissible: boolean;
  reasons: readonly string[];
  matchedAssertionRefs: readonly string[];
}

export function assertProductTruthLock(lock: ProductTruthLock): void {
  if (!lock.id.trim() || !lock.productId.trim()) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_IDENTITY_REQUIRED");
  }
  if (!Number.isInteger(lock.version) || lock.version < 1) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_VERSION_INVALID");
  }
  if (!lock.assertions.length) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_ASSERTIONS_REQUIRED");
  }
  if (!lock.referenceAssetIds.length) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_REFERENCE_ASSETS_REQUIRED");
  }
  if (!lock.evidenceIds.length) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_EVIDENCE_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(lock.lockedAt))) {
    throw new Error("DIRECTOR_PRODUCT_TRUTH_LOCKED_AT_INVALID");
  }

  const identities = new Set<string>();
  for (const assertion of lock.assertions) {
    if (!assertion.key.trim() || !assertion.value.trim() || !assertion.sourceRef.trim()) {
      throw new Error("DIRECTOR_PRODUCT_TRUTH_ASSERTION_INVALID");
    }
    if (!assertion.evidenceIds.length) {
      throw new Error("DIRECTOR_PRODUCT_TRUTH_ASSERTION_EVIDENCE_REQUIRED");
    }
    const identity = assertionIdentity(assertion);
    if (identities.has(identity)) {
      throw new Error(`DIRECTOR_PRODUCT_TRUTH_DUPLICATE_ASSERTION:${identity}`);
    }
    identities.add(identity);
  }
}

export function evaluateProductCreativeRepresentation(input: {
  lock: ProductTruthLock;
  representations: readonly ProductCreativeRepresentation[];
}): ProductTruthEvaluation {
  assertProductTruthLock(input.lock);
  const reasons: string[] = [];
  const matchedAssertionRefs: string[] = [];

  for (const proposed of input.representations) {
    if (!proposed.key.trim() || !proposed.value.trim()) {
      reasons.push("DIRECTOR_PRODUCT_TRUTH_PROPOSED_VALUE_INVALID");
      continue;
    }

    const candidates = input.lock.assertions.filter(
      (assertion) =>
        assertion.field === proposed.field &&
        normalize(assertion.key) === normalize(proposed.key),
    );
    if (!candidates.length) {
      reasons.push(
        `DIRECTOR_PRODUCT_TRUTH_UNSUPPORTED_FIELD:${proposed.field}:${proposed.key}`,
      );
      continue;
    }

    const match = candidates.find(
      (assertion) => normalize(assertion.value) === normalize(proposed.value),
    );
    if (!match) {
      reasons.push(
        `DIRECTOR_PRODUCT_TRUTH_MISMATCH:${proposed.field}:${proposed.key}`,
      );
      continue;
    }

    matchedAssertionRefs.push(
      `${match.field}:${normalize(match.key)}:${normalize(match.value)}`,
    );
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    matchedAssertionRefs: Object.freeze([...new Set(matchedAssertionRefs)]),
  });
}

export function compileProductTruthDirective(lock: ProductTruthLock): string {
  assertProductTruthLock(lock);
  const assertions = [...lock.assertions]
    .sort((a, b) =>
      a.field.localeCompare(b.field) ||
      a.key.localeCompare(b.key) ||
      a.value.localeCompare(b.value),
    )
    .map((assertion) => `- ${assertion.field} / ${assertion.key}: ${assertion.value}`);

  return [
    `Product Truth Lock: ${lock.id} (product ${lock.productId}, version ${lock.version}).`,
    "The generated asset must preserve these product facts exactly and must not invent unsupported product attributes, accessories, functions, results, compatibility, safety properties, packaging contents, label text, or performance.",
    ...assertions,
  ].join("\n");
}

function assertionIdentity(
  assertion: Pick<ProductTruthAssertion, "field" | "key">,
): string {
  return `${assertion.field}:${normalize(assertion.key)}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
