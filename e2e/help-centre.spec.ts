import { expect, test } from "@playwright/test";

test("legacy Help Centre and Status paths permanently redirect to their standalone services", async ({ request }) => {
  const redirects = [
    ["/help", "https://help.snoozer.uk/"],
    ["/help/premium-billing", "https://help.snoozer.uk/premium-billing"],
    ["/status", "https://status.snoozer.uk/"],
    ["/status/incidents/current", "https://status.snoozer.uk/incidents/current"],
  ] as const;

  for (const [path, destination] of redirects) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(308);
    expect(response.headers().location, path).toBe(destination);
  }
});
