import { z } from "zod";
import { safeLink } from "./safe-link";

const common = {
  id: z.uuid(),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  width: z.enum(["full", "half", "third"]).default("full"),
  align: z.enum(["start", "center", "end"]).default("start"),
  variant: z.enum(["plain", "surface", "outline", "accent"]).default("surface"),
};

export const profileBlock = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("heading"), text: z.string().trim().min(1).max(160), level: z.enum(["h2", "h3"]).default("h2") }),
  z.strictObject({ ...common, type: z.literal("about"), heading: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(2000) }),
  z.strictObject({ ...common, type: z.literal("callout"), heading: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(1200), tone: z.enum(["neutral", "accent", "info", "success", "warning"]).default("accent") }),
  z.strictObject({ ...common, type: z.literal("quote"), quote: z.string().trim().min(1).max(1000), attribution: z.string().trim().max(100) }),
  z.strictObject({ ...common, type: z.literal("project"), title: z.string().trim().min(1).max(100), description: z.string().trim().max(600), url: z.string().trim().max(2048).refine(safeLink, "Enter a valid project URL."), buttonLabel: z.string().trim().min(1).max(40).default("View project") }),
  z.strictObject({ ...common, type: z.literal("skills"), heading: z.string().trim().min(1).max(80), items: z.array(z.string().trim().min(1).max(60)).min(1).max(20) }),
  z.strictObject({ ...common, type: z.literal("cta"), heading: z.string().trim().min(1).max(100), body: z.string().trim().max(600), label: z.string().trim().min(1).max(40), url: z.string().trim().max(2048).refine(safeLink, "Enter a valid call-to-action URL.") }),
  z.strictObject({ ...common, type: z.literal("divider"), style: z.enum(["line", "space", "dotted"]).default("line") }),
  z.strictObject({ ...common, type: z.literal("countdown"), heading: z.string().trim().min(1).max(80), target: z.iso.datetime({ offset: true }) }),
  z.strictObject({ ...common, type: z.literal("stats"), heading: z.string().trim().min(1).max(80), items: z.array(z.strictObject({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(40) })).min(1).max(6) }),
]);

export type ProfileBlock = z.infer<typeof profileBlock>;
export const profileBlocks = z.array(profileBlock).max(32).superRefine((blocks, context) => {
  const ids = blocks.map((block) => block.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: [], message: "Block identifiers must be unique." });
});

export function makeProfileBlock(type: ProfileBlock["type"]): ProfileBlock {
  const id = crypto.randomUUID();
  const common = { id, hidden: false, locked: false, width: "full" as const, align: "start" as const, variant: "surface" as const };
  switch (type) {
    case "heading": return { ...common, type, text: "Section heading", level: "h2" };
    case "about": return { ...common, type, heading: "About me", body: "Write a short introduction." };
    case "callout": return { ...common, type, heading: "Announcement", body: "Share an important update.", tone: "accent" };
    case "quote": return { ...common, type, quote: "Add a quote worth sharing.", attribution: "Your name" };
    case "project": return { ...common, type, title: "Featured project", description: "Describe what you built.", url: "https://example.org/project", buttonLabel: "View project" };
    case "skills": return { ...common, type, heading: "Skills and interests", items: ["Add a skill"] };
    case "cta": return { ...common, type, heading: "Let’s work together", body: "Tell visitors what to do next.", label: "Get in touch", url: "https://example.org/contact" };
    case "divider": return { ...common, type, style: "line" };
    case "countdown": return { ...common, type, heading: "Coming soon", target: new Date(Date.now() + 7 * 86400000).toISOString() };
    case "stats": return { ...common, type, heading: "By the numbers", items: [{ label: "Projects", value: "10+" }] };
  }
}
