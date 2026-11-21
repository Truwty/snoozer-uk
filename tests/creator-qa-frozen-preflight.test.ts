import { describe, expect, it } from "vitest";
import { inspectCreatorQaFrozenVersion } from "../src/lib/creator-qa-frozen-preflight";
import { creatorQaDraft, creatorDiscountQaDraft } from "../src/lib/creator-qa-studio";

const expected = { bytes: 618, sha256: "a".repeat(64) };
const frozen = { title: creatorQaDraft.title, amount: 50, bytes: 618, sha256: expected.sha256 };
describe("owner-side isolated QA frozen-version reference preflight", () => {
  it("matches the exact frozen preset metadata without treating it as approval", () => {
    expect(inspectCreatorQaFrozenVersion(frozen, expected)).toEqual({matchesReferenceMetadata:true,mismatches:[]});
  });
  it("rejects a same-byte-size but different-SHA version", () => {
    expect(inspectCreatorQaFrozenVersion({...frozen,sha256:"b".repeat(64)},expected)).toEqual({
      matchesReferenceMetadata:false,mismatches:["Frozen SHA-256 differs from the reference PDF."]
    });
  });
  it("rejects a changed byte count even if the hash field claims the expected value", () => {
    expect(inspectCreatorQaFrozenVersion({...frozen,bytes:619},expected).matchesReferenceMetadata).toBe(false);
  });
  it("rejects a changed price and original QA draft title even if the file matches", () => {
    expect(inspectCreatorQaFrozenVersion({...frozen,amount:500,title:"Another product"},expected).mismatches)
      .toEqual(["Frozen title differs from the QA preset.","Frozen price must be £0.50."]);
  });
  it("rejects all four mismatches rather than hiding the remaining problems", () => {
    expect(inspectCreatorQaFrozenVersion({title:"Other",amount:51,bytes:617,sha256:"b".repeat(64)},expected).mismatches).toHaveLength(4);
  });
});

it("matches a distinct £2 discount QA preset but rejects altered discount prices and hashes", () => {
  const discount={...frozen,title:creatorDiscountQaDraft.title,amount:200};
  expect(inspectCreatorQaFrozenVersion(discount,expected)).toEqual({matchesReferenceMetadata:true,mismatches:[]});
  expect(inspectCreatorQaFrozenVersion({...discount,amount:50},expected).mismatches).toEqual(["Frozen discount QA price must be £2.00."]);
  expect(inspectCreatorQaFrozenVersion({...discount,sha256:"b".repeat(64)},expected).matchesReferenceMetadata).toBe(false);
  expect(inspectCreatorQaFrozenVersion({...frozen,amount:200},expected).matchesReferenceMetadata).toBe(false);
});
