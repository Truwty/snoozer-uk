import { expect, it } from "vitest";
import { estimateGalleryMemory, galleryAdvisoryBudget, galleryMemoryWarning } from "../src/lib/gallery-budget";

it("shows an advisory only when decoded gallery dimensions exceed the budget", () => {
  const large = { width: 1280, height: 1280 };
  expect(galleryMemoryWarning([])).toBeNull();
  expect(galleryMemoryWarning([large])).toBeNull();
  expect(galleryMemoryWarning([large, large])).toBe("12.5");
});

it("allows an estimate exactly at the budget", () => {
  const images = Array.from({ length: 3 }, () => ({ width: 1024, height: 1024 }));
  expect(estimateGalleryMemory(images)).toBe(galleryAdvisoryBudget);
  expect(galleryMemoryWarning(images)).toBeNull();
});
