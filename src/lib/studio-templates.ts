import type { ProfileContent, TextSection } from "./profile";

type StudioTemplate = {
  id: string;
  name: string;
  description: string;
  theme: ProfileContent["theme"];
  sections: TextSection[];
  appearance?: ProfileContent["appearance"];
};

const starters: readonly StudioTemplate[] = [
  {
    id: "project-notebook",
    name: "Project notebook",
    description: "Midnight colours with sections for projects and notes.",
    theme: "midnight",
    sections: [
      { heading: "Current projects", body: "A space for the work I’m doing now." },
      { heading: "Notes", body: "A place for ideas, updates and things I want to remember." },
    ],
  },
  {
    id: "hello-page",
    name: "Hello page",
    description: "Warm daybreak colours with a short introduction.",
    theme: "daybreak",
    sections: [{ heading: "A little about me", body: "A place to introduce myself and share what matters to me." }],
  },
  {
    id: "field-guide",
    name: "Field guide",
    description: "Cool lagoon colours with room for favourites and new discoveries.",
    theme: "lagoon",
    sections: [
      { heading: "Favourites", body: "Things I like enough to share." },
      { heading: "Recent discoveries", body: "New things I’m exploring." },
    ],
  },
];

// Existing starter copy, presented in distinct supported appearance combinations.
export const studioTemplates: readonly StudioTemplate[] = [...starters, ...starters.flatMap((template) => [
  { ...template, id: template.id + "-compact", name: template.name + " · Compact", description: template.description + " Compact spacing and square corners.",
    appearance: { density: "compact", corners: "square", layout: "centred", accent: "theme", entrance: "none" } as const },
  { ...template, id: template.id + "-editorial", name: template.name + " · Editorial", description: template.description + " An editorial layout with balanced spacing.",
    appearance: { density: "balanced", corners: "soft", layout: "editorial", accent: "theme", entrance: "none" } as const },
  { ...template, id: template.id + "-airy", name: template.name + " · Airy", description: template.description + " Airy spacing and rounded corners.",
    appearance: { density: "airy", corners: "round", layout: "centred", accent: "theme", entrance: "none" } as const },
])];
