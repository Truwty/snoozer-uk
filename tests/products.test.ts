import { describe, expect, it } from "vitest";
import { priceInput, productDescription, productPrice, productTitle } from "../src/lib/products";

describe("private product drafts", () => {
  it("converts exact decimal GBP input to integer pence", () => {
    expect(productPrice.parse("0.50")).toBe(50);
    expect(productPrice.parse("12.3")).toBe(1230);
    expect(productPrice.parse("1000.00")).toBe(100000);
    expect(priceInput(1999)).toBe("19.99");
  });
  it("rejects under/overpriced, ambiguous and non-finite prices", () => {
    for (const value of ["0", "0.49", "1000.01", "01.00", "1e2", "-1", "1.001", "NaN", "Infinity", "£5", "1,00", " 5 "]) expect(productPrice.safeParse(value).success).toBe(false);
  });
  it("bounds plain-text copy and rejects control characters", () => {
    expect(productTitle.parse(" A creator guide ")).toBe("A creator guide");
    expect(productDescription.parse("Line one\nLine two\tTabbed")).toContain("\n");
    for (const title of [" ", "a".repeat(101), "Hidden\u0000name", "New\nline"]) expect(productTitle.safeParse(title).success).toBe(false);
    expect(productDescription.safeParse("a".repeat(2001)).success).toBe(false);
    expect(productDescription.safeParse("control\u0001").success).toBe(false);
  });
});
