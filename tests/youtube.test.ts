import { describe, expect, it } from "vitest";
import { youtubeVideoId } from "../src/lib/youtube";
const id = "M7lc1UVf-VE";
describe("first-party YouTube widget routing", () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}&t=10`, `https://youtu.be/${id}`,
    `https://m.youtube.com/shorts/${id}`, `https://youtube.com/embed/${id}`,
  ])("derives the video ID from a supported HTTPS URL: %s", (url) => expect(youtubeVideoId(url)).toBe(id));
  it.each([
    `http://youtube.com/watch?v=${id}`, `https://youtube.com.evil.com/watch?v=${id}`,
    `https://youtube.com@evil.com/watch?v=${id}`, `https://user@youtube.com/watch?v=${id}`,
    `https://youtube.com:444/watch?v=${id}`, "javascript:alert(1)", "not a URL",
    "https://youtube.com/watch?v=bad", "https://youtube.com/playlist?list=example",
    `https://youtu.be/${id}/extra`,
  ])("falls back to the normal link for unsupported input: %s", (url) => expect(youtubeVideoId(url)).toBeNull());
});
