# Snoozer profile template library

The first-party template library contains 120 free designs built from 30 distinct visual compositions and four colour treatments (Nocturne, Glacier, Parchment and Afterglow).

## Categories

- Minimal: Slate, Monograph, Paper Margin
- Anime & illustration: Sakura Dream, Oni Bloom, Cel Shaded
- Cinematic: Noir Frame, Last Light, 35mm Grain
- Cyber & tech: Terminal, Green Matrix, Synthwave 84
- Nature: Moss & Fern, Deep Current, Desert Bloom
- Gaming: Arcade Cabinet, Esports Arena, Pixel Quest
- Creative: Creative Studio, Brutalist Grid, White Cube
- Music: Vinyl Room, Waveform, Backstage Pass
- Pastel: Cloud Nine, Soft Bloom, Lilac Haze
- Luxury: Obsidian Club, Goldline, Velvet Room

Each composition has its own validated `templateStyle` token and responsive CSS treatment. Colour treatments set background, typography, accent, icon and decorative colours independently of profile content.

## Applying a design

A selected template changes theme and appearance only. A user-uploaded gallery background and existing motion effects are preserved. Links, badges, widgets, gallery items, text sections, blocks, SEO settings and publication state are not replaced. Sample text sections are offered separately and are only inserted when the profile has no existing sections.

The public profile card, Studio preview and template gallery all use the same ProfileCard renderer. Older profiles without a `templateStyle` value retain the classic presentation.

## Adding a composition

Add a style identifier to `profileTemplateStyles` in `src/lib/profile.ts`, then add one composition record to `src/lib/studio-templates.ts`. Every composition is expanded into all four palettes automatically. The catalogue tests enforce 120 entries, 30 styles and ten categories.

Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` before release.
