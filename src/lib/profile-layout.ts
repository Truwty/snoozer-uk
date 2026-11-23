import { z } from "zod";

const sectionItem = z.strictObject({
  type: z.literal("section"),
  index: z.number().int().min(0).max(5),
});
const layoutItem = z.discriminatedUnion("type", [
  sectionItem,
  z.strictObject({ type: z.literal("links") }),
  z.strictObject({ type: z.literal("widgets") }),
  z.strictObject({ type: z.literal("gallery") }),
]);

export const profilePageLayout = z.strictObject({
  version: z.literal(1),
  items: z.array(layoutItem).max(9),
}).superRefine((value, context) => {
  const keys = value.items.map((item) => item.type === "section" ? `section:${item.index}` : item.type);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Page elements must have unique positions." });
  }
});

export type ProfilePageLayout = z.infer<typeof profilePageLayout>;
export type ProfilePageLayoutItem = ProfilePageLayout["items"][number];

export type ProfileLayoutContent = {
  sections: readonly unknown[];
  links: readonly unknown[];
  widgets: {
    guestbook: { enabled: boolean };
    testimonials: { enabled: boolean };
    poll: { enabled: boolean };
    faq: { enabled: boolean };
  };
  gallery?: readonly unknown[];
};

function keyOf(item: ProfilePageLayoutItem): string {
  return item.type === "section" ? `section:${item.index}` : item.type;
}

function defaultItems(content: ProfileLayoutContent): ProfilePageLayoutItem[] {
  const items: ProfilePageLayoutItem[] = content.sections.map((_, index) => ({ type: "section", index }));
  if (content.links.length > 0) items.push({ type: "links" });
  const hasWidgets = (["guestbook", "testimonials", "poll", "faq"] as const)
    .some((kind) => content.widgets[kind].enabled);
  if (hasWidgets) items.push({ type: "widgets" });
  if (content.gallery?.length) items.push({ type: "gallery" });
  return items;
}

/** Normalise legacy, stale or partially edited layouts against live draft content. */
export function normalizeProfilePageLayout(
  value: unknown,
  content: ProfileLayoutContent,
): ProfilePageLayout {
  const parsed = profilePageLayout.safeParse(value);
  const candidates = parsed.success && parsed.data.items.length > 0 ? parsed.data.items : defaultItems(content);
  const allowed = new Set(defaultItems(content).map(keyOf));
  const items: ProfilePageLayoutItem[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const key = keyOf(item);
    if (!allowed.has(key) || seen.has(key)) continue;
    if (item.type === "section" && item.index >= content.sections.length) continue;
    items.push(item);
    seen.add(key);
  }

  for (const item of defaultItems(content)) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      items.push(item);
      seen.add(key);
    }
  }

  return { version: 1, items };
}

export function moveProfilePageElement(
  value: unknown,
  from: number,
  to: number,
  content: ProfileLayoutContent,
): ProfilePageLayout {
  const layout = normalizeProfilePageLayout(value, content);
  if (from < 0 || to < 0 || from >= layout.items.length || to >= layout.items.length || from === to) return layout;
  const items = [...layout.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return { version: 1, items };
}

/**
 * Preserve section references when existing section controls reorder or edit
 * their array. Object identity survives sorting; same-index fallback retains a
 * section when an in-place edit creates its replacement object.
 */
export function remapProfileSectionPositions(
  value: unknown,
  previous: readonly unknown[],
  next: readonly unknown[],
  content: ProfileLayoutContent,
): ProfilePageLayout {
  const layout = normalizeProfilePageLayout(value, { ...content, sections: previous });
  const items: ProfilePageLayoutItem[] = [];

  for (const item of layout.items) {
    if (item.type !== "section") {
      items.push(item);
      continue;
    }
    const prior = previous[item.index];
    let nextIndex = next.indexOf(prior);
    if (nextIndex < 0 && previous.length === next.length && item.index < next.length) nextIndex = item.index;
    if (nextIndex >= 0) items.push({ type: "section", index: nextIndex });
  }

  return normalizeProfilePageLayout({ version: 1, items }, { ...content, sections: next });
}
