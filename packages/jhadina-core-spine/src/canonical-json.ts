export const CANONICALIZATION_VERSION = '1' as const;

export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { readonly [key: string]: CanonicalJson };

export interface CanonicalizeOptions {
  maxDepth?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxBytes?: number;
}

const DEFAULTS: Required<CanonicalizeOptions> = {
  maxDepth: 64,
  maxArrayLength: 10_000,
  maxObjectKeys: 10_000,
  maxBytes: 1_048_576,
};

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

/**
 * Produces the Jhadina canonical JSON representation used for identity and
 * hashing. This intentionally accepts a restricted data model instead of
 * applying JSON.stringify's lossy coercions to arbitrary JavaScript values.
 */
export function canonicalize(
  value: unknown,
  options: CanonicalizeOptions = {},
): string {
  const limits = { ...DEFAULTS, ...options };
  const output = serialize(value, 0, '$', limits);
  const bytes = new TextEncoder().encode(output).byteLength;

  if (bytes > limits.maxBytes) {
    throw new CanonicalizationError(
      `Canonical JSON exceeds maxBytes (${limits.maxBytes})`,
    );
  }

  return output;
}

export function canonicalBytes(
  value: unknown,
  options: CanonicalizeOptions = {},
): Uint8Array {
  return new TextEncoder().encode(canonicalize(value, options));
}

function serialize(
  value: unknown,
  depth: number,
  path: string,
  limits: Required<CanonicalizeOptions>,
): string {
  if (depth > limits.maxDepth) {
    throw new CanonicalizationError(`Maximum depth exceeded at ${path}`);
  }

  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value.normalize('NFC'));
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(`Non-finite number at ${path}`);
      }
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'undefined':
      throw new CanonicalizationError(`undefined is not canonical at ${path}`);
    case 'bigint':
      throw new CanonicalizationError(`bigint is not canonical at ${path}`);
    case 'function':
      throw new CanonicalizationError(`function is not canonical at ${path}`);
    case 'symbol':
      throw new CanonicalizationError(`symbol is not canonical at ${path}`);
    case 'object':
      break;
    default:
      throw new CanonicalizationError(`Unsupported value at ${path}`);
  }

  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) {
      throw new CanonicalizationError(
        `Array exceeds maxArrayLength (${limits.maxArrayLength}) at ${path}`,
      );
    }
    return `[${value.map((item, index) => serialize(item, depth + 1, `${path}[${index}]`, limits)).join(',')}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalizationError(`Non-plain object is not canonical at ${path}`);
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new CanonicalizationError(`Symbol keys are not canonical at ${path}`);
  }

  const keys = Object.keys(value);
  if (keys.length > limits.maxObjectKeys) {
    throw new CanonicalizationError(
      `Object exceeds maxObjectKeys (${limits.maxObjectKeys}) at ${path}`,
    );
  }

  const normalizedKeys = keys.map((key) => ({
    original: key,
    normalized: key.normalize('NFC'),
  }));
  normalizedKeys.sort((a, b) => a.normalized < b.normalized ? -1 : a.normalized > b.normalized ? 1 : 0);

  for (let index = 1; index < normalizedKeys.length; index += 1) {
    if (normalizedKeys[index - 1].normalized === normalizedKeys[index].normalized) {
      throw new CanonicalizationError(
        `Object keys collide after NFC normalization at ${path}`,
      );
    }
  }

  const entries = normalizedKeys.map(({ original, normalized }) => {
    const descriptor = descriptors[original];
    if (!descriptor || !('value' in descriptor)) {
      throw new CanonicalizationError(`Accessor property is not canonical at ${path}.${original}`);
    }
    return `${JSON.stringify(normalized)}:${serialize(descriptor.value, depth + 1, `${path}.${original}`, limits)}`;
  });

  return `{${entries.join(',')}}`;
}
