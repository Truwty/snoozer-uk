# Studio sections and templates

Creators can add up to six sections and select Text, Callout, Quote or Countdown for each. Callouts highlight an update; quotes display the text with an attribution. The heading or attribution can have up to 80 characters and the body up to 800 characters. Studio displays sections above the link list. Both fields must contain text before the editor will save the draft. Link order and section order are independent.

Select a template in Studio to see a private preview. Apply its colours to any draft. If the draft has no text sections, you can also add the starter sections. Applying a template is a single undoable draft edit. Existing sections, profile identity, links and avatar are preserved. The selected template preview itself never saves or publishes. The preview width selector offers wide, 375 px and 320 px views. Templates change colour themes and optionally starter sections. They leave your card spacing and corner settings in place. On narrow editor screens, the preview fits the space available.

Section text is rendered as text, including line breaks and HTML-like characters. No HTML, embeds or external template assets are accepted. The built-in catalogue is defined in source. Applying a template saves only the resulting theme and text, so catalogue edits do not alter existing profiles.

Migration 20261110000800 adds relational draft and publication section tables. The revision-checked save RPC accepts an optional final section argument for compatibility with older callers. Omitting it preserves draft sections, while passing an empty array clears them. Saving, publishing and restoring sections are part of the same transactions as the rest of the profile. Public reads return only the active publication. Private history remains owner-scoped.

Migration `20261110001200_section_types.sql` adds an allowlisted type to draft and publication rows. Existing rows still render as plain text. A previous app build can read those rows, but may convert new section types to plain text if it saves the draft. Apply the migration before deploying the new editor and prefer a forward fix over rolling back to an editor that cannot save the type.

## Section visibility

Use **Hide section from public profile** to omit a section from the public preview and the next publication. The editor keeps the section available for editing, moving or showing again. Publish to apply the change to the live page. Restoring an earlier version restores that version's visibility settings in the draft.

Migration 20261110001700 keeps hidden content in owner-only snapshots. The public profile endpoint excludes the entire hidden section, including its text and any countdown target. Hidden sections count towards the six-section limit. When a draft contains hidden sections, the save RPC rejects older clients that replace sections without explicit visibility settings.

## Countdown

Add a section, choose **Countdown**, and enter its heading, description and target date and time in UTC. Countdown sections use one of the six existing section slots. A valid target appears as a date in Studio, history and the public page. The date is readable with JavaScript disabled. With JavaScript enabled, the timer rounds up to the next minute and shows **Countdown finished.** at the target. Past targets are supported.

Migration 20261110001600 stores the UTC minute in draft and publication rows. A malformed or missing target blocks saving and the database rejects it with SQLSTATE 22023. Countdown uses the browser clock, so a device with an incorrect clock may show the wrong remaining time. The saved UTC date is the reference.

## Appearance

Studio offers Centred card and Editorial layouts. Editorial places the avatar beside the title on wider cards and stacks them on phones. Studio also offers Compact, Balanced and Airy spacing and Square, Soft and Round corners. The shared renderer applies the same named CSS values to previews and live pages. Balanced and Soft preserve the existing design. These choices change spacing and radii; profile colours and link target sizes are unaffected. The editor does not accept raw CSS or script.

Migration `20261110001300_appearance_tokens.sql` checks the token names and snapshots them with the rest of the profile. An old request that omits the optional appearance argument keeps the existing choices. A restore changes the draft. Publish to make it live. Migration 20261110001400 adds the layout choice and treats older appearance settings as Centred card.

Studio's link accent control offers Mint, Rose and Ink. For these presets, the renderer selects black or white text and Studio reports the resulting contrast ratio. The presets meet the 4.5 to 1 minimum for normal link text. The default uses the active theme's link colours. Migration 20261110001500 accepts only the named accents. [WCAG 2.2 contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum)

The public gallery at `/templates` shows the same catalogue. Its Studio links preselect the relevant preview for signed-in creators who already have a profile. Creator-submitted templates, embeds and interactive blocks remain future work.
