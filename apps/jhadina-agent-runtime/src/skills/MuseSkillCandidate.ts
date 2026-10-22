import { createHash } from "node:crypto";
import { SkillRegistry, type SkillDefinition } from "./SkillRegistry";
import { SkillScanner, type SkillScanResult } from "./SkillScanner";

/**
 * JH-MUSE.PARITY.01: an UNTRUSTED, pinned community skill can be proposed
 * for review. Nothing here grants authority, installs code, or runs prose.
 */
export interface MuseSkillCandidate {
  definition: SkillDefinition;
  sourceCommit: string;
  sha256: string;
  scan: SkillScanResult;
  untrustedPreview: string;
}

export function proposeMuseSkillCandidate(input: {
  sourceUrl: string;
  markdown: string;
  registry: SkillRegistry;
}): MuseSkillCandidate {
  const match = /^https:\/\/raw\.githubusercontent\.com\/aicodedecode\/awesome-muse-skills\/([a-f0-9]{40})\/skills\/([a-z0-9][a-z0-9-]*)\/SKILL\.md$/.exec(input.sourceUrl);
  if (!match) throw new Error("Muse skill source must be pinned to a full commit SHA and original skill path");
  if (!input.markdown || input.markdown.length > 65536 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.markdown)) {
    throw new Error("Invalid or oversized external skill text");
  }
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(input.markdown);
  if (!frontmatter) throw new Error("External skill lacks bounded frontmatter");
  const lines = frontmatter[1].split(/\r?\n/);
  const field = (name: string) => {
    const matches = lines.filter(line => line.startsWith(name + ":"));
    if (matches.length !== 1) throw new Error("Missing or ambiguous skill metadata: " + name);
    return matches[0].slice(name.length + 1).trim();
  };
  const name = field("name");
  const description = field("description");
  if (name !== match[2] || !description || description.length > 500 ||
      /[\r\n]/.test(description)) throw new Error("Invalid skill identity or description");
  const id = "muse-ref." + match[2];
  if (input.registry.get(id)) throw new Error("Skill already registered; refusing replacement");
  const definition: SkillDefinition = {
    id, name, version: "0.0.1", description,
    capabilities: [], status: "candidate", source: input.sourceUrl,
  };
  const scan = new SkillScanner().scan(definition);
  if (!scan.approved) throw new Error("Skill metadata scan failed");
  input.registry.register(definition);
  return {
    definition, sourceCommit: match[1],
    sha256: "sha256:" + createHash("sha256").update(input.markdown).digest("hex"),
    scan,
    // Display-only, never privileged instructions or an executable skill.
    untrustedPreview: input.markdown,
  };
}
