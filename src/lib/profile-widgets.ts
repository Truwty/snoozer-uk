import { z } from "zod";

export const profileWidgetKinds = ["guestbook", "testimonials", "poll", "faq"] as const;
export type ProfileWidgetKind = typeof profileWidgetKinds[number];

const uuid = z.uuid();
const testimonial = z.strictObject({
  id: uuid, quote: z.string().trim().min(1).max(500), author: z.string().trim().min(1).max(80),
  role: z.string().trim().max(80),
});
const faqItem = z.strictObject({
  id: uuid, question: z.string().trim().min(1).max(120), answer: z.string().trim().min(1).max(1000),
});
const pollOption = z.strictObject({ id: uuid, label: z.string().trim().max(80) });

export const profileWidgets = z.strictObject({
  version: z.literal(1),
  order: z.array(z.enum(profileWidgetKinds)).length(4).refine(
    (items) => new Set(items).size === profileWidgetKinds.length,
    "Each widget must have one unique position.",
  ),
  guestbook: z.strictObject({
    enabled: z.boolean(), heading: z.string().trim().min(1).max(80),
    description: z.string().max(240), maxEntries: z.number().int().min(1).max(10),
    submissionsOpen: z.boolean(),
  }),
  testimonials: z.strictObject({
    enabled: z.boolean(), heading: z.string().trim().min(1).max(80), items: z.array(testimonial).max(6),
  }).superRefine((value, context) => {
    if (value.enabled && value.items.length === 0) context.addIssue({
      code: "custom", path: ["items"], message: "Add at least one testimonial before enabling this widget.",
    });
    if (new Set(value.items.map((item) => item.id)).size !== value.items.length) context.addIssue({
      code: "custom", path: ["items"], message: "Testimonial identifiers must be unique.",
    });
  }),
  poll: z.strictObject({
    enabled: z.boolean(), id: uuid, question: z.string().trim().max(180), options: z.array(pollOption).max(6),
    open: z.boolean(), closesAt: z.iso.datetime({ offset: true }).nullable(), showResultsBeforeVote: z.boolean(),
  }).superRefine((value, context) => {
    if (value.enabled && value.question.length < 5) context.addIssue({
      code: "custom", path: ["question"], message: "Poll questions must contain at least five characters.",
    });
    if (value.enabled && (value.options.length < 2 || value.options.some((option) => !option.label))) context.addIssue({
      code: "custom", path: ["options"], message: "Add two to six non-empty voting options.",
    });
    if (new Set(value.options.map((option) => option.id)).size !== value.options.length) context.addIssue({
      code: "custom", path: ["options"], message: "Poll option identifiers must be unique.",
    });
  }),
  faq: z.strictObject({
    enabled: z.boolean(), heading: z.string().trim().min(1).max(80), items: z.array(faqItem).max(10),
  }).superRefine((value, context) => {
    if (value.enabled && value.items.length === 0) context.addIssue({
      code: "custom", path: ["items"], message: "Add at least one question before enabling the FAQ.",
    });
    if (new Set(value.items.map((item) => item.id)).size !== value.items.length) context.addIssue({
      code: "custom", path: ["items"], message: "FAQ identifiers must be unique.",
    });
  }),
}).superRefine((value, context) => {
  const labels = value.poll.options.map((option) => option.label.trim().toLocaleLowerCase("en-GB")).filter(Boolean);
  if (new Set(labels).size !== labels.length) context.addIssue({
    code: "custom", path: ["poll", "options"], message: "Poll options must be different.",
  });
});

export const defaultProfileWidgets: ProfileWidgets = {
  version: 1, order: ["guestbook", "testimonials", "poll", "faq"],
  guestbook: { enabled: false, heading: "Guestbook", description: "Leave a message.", maxEntries: 10, submissionsOpen: true },
  testimonials: { enabled: false, heading: "Testimonials", items: [] },
  poll: { enabled: false, id: "00000000-0000-4000-8000-000000000001", question: "", options: [], open: true, closesAt: null, showResultsBeforeVote: false },
  faq: { enabled: false, heading: "Frequently asked questions", items: [] },
};
export type ProfileWidgets = z.infer<typeof profileWidgets>;
