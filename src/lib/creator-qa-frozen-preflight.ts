import type { ProductVersion } from "./product-versions";
import { creatorQaDraft } from "./creator-qa-studio";

// This inspects owner-visible frozen version metadata only. It does NOT read,
// hash, scan or independently approve the actual stored PDF bytes.
export function inspectCreatorQaFrozenVersion(
  version: Pick<ProductVersion, "title" | "amount" | "bytes" | "sha256">,
  expected: { bytes: number; sha256: string },
) {
  const mismatches: string[] = [];
  if (version.title !== creatorQaDraft.title) mismatches.push("Frozen title differs from the QA preset.");
  if (version.amount !== 50) mismatches.push("Frozen price must be £0.50.");
  if (version.bytes !== expected.bytes) mismatches.push("Frozen byte count differs from the reference PDF.");
  if (version.sha256 !== expected.sha256) mismatches.push("Frozen SHA-256 differs from the reference PDF.");
  return { matchesReferenceMetadata: mismatches.length === 0, mismatches };
}
