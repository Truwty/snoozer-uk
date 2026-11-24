import { describe, expect, it } from "vitest";
import { socialBrandPaths } from "../src/lib/social-brand-paths";
import { socialProviders } from "../src/lib/social-providers";

describe("social brand icons", () => {
  it("bundles a vector mark for every supported social provider", () => {
    for (const provider of socialProviders) {
      const paths = socialBrandPaths[provider.id];
      expect(paths, `Missing icon paths for ${provider.id}`).toBeDefined();
      expect(paths?.length, `Missing SVG path data for ${provider.id}`).toBeGreaterThan(0);
      expect(paths?.every((path) => path.trim().length > 0), `Empty SVG path for ${provider.id}`).toBe(true);
    }
  });

  it("renders recognisable provider marks as SVG paths, not text initials", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SocialProviderIcon } = await import("../src/components/social-provider-icon");

    for (const [providerId, initials] of [
      ["instagram", "IG"],
      ["tiktok", "TT"],
      ["youtube", "YT"],
      ["discord", "DC"],
    ] as const) {
      const markup = renderToStaticMarkup(createElement(SocialProviderIcon, { providerId }));
      expect(markup).toContain("<svg");
      expect(markup).toContain("<path");
      expect(markup).not.toContain(`>${initials}<`);
    }
  });
});
