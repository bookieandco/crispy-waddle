/**
 * Source-only JH-INDEPENDENT.BUILD private-preview exception.
 * Does not authorize any API, persistence, owner data, or production paths.
 * Vercel deployment protection / SSO must remain separately enabled.
 */
export const INDEPENDENT_LAB_PATH = "/jhadina-independent-lab.html" as const;
export const INDEPENDENT_LAB_BRANCH = "feat/jh-independent-build-01-06-20261019" as const;

export function allowIndependentLabRead(input: {
  pathname: string;
  method: string;
  vercelEnv?: string;
  gitRef?: string;
}): boolean {
  return input.pathname === INDEPENDENT_LAB_PATH
    && (input.method === "GET" || input.method === "HEAD")
    && input.vercelEnv === "preview"
    && input.gitRef === INDEPENDENT_LAB_BRANCH;
}
