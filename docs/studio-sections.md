# Studio sections and templates

**Reviewed:** 27 November 2026. This guide covers the legacy section system and its current integration with the ordered public-page layout and typed profile blocks.

Creators can add up to six sections and select Text, Callout, Quote or Countdown for each. Callouts highlight an update; quotes display the text with an attribution. The heading or attribution can have up to 80 characters and the body up to 800 characters. Studio displays sections above the link list. Both fields must contain text before the editor will save the draft. Link order and section order are independent.

Select a template in Studio to see a private preview. Apply its colours to any draft. If the draft has no text sections, you can also add the starter sections. Applying a template is a single undoable draft edit. Existing sections, profile identity, links and avatar are preserved. The selected template preview itself never saves or publishes. The preview width selector offers wide, 375 px and 320 px views. Templates change colour themes and optionally starter sections. They leave your card spacing and corner settings in place. On narrow editor screens, the preview fits the space available.

Section text is rendered as text, including line breaks and HTML-like characters. No HTML, embeds or external template assets are accepted. The built-in catalogue is defined in source. Applying a template saves only the resulting theme and text, so catalogue edits do not alter existing profiles.

Migration 20261110000800 adds relational draft and publication section tables. The revision-checked save RPC accepts an optional final section argument for compatibility with older callers. Omitting it preserves draft sections, while passing an empty array clears them. Saving, publishing and restoring sections are part of the same transactions as the rest of the profile. Public reads return only the active publication. Private history remains owner-scoped.

Migration `20261110001200_section_types.sql` adds an allowlisted type to draft and publication rows. Existing rows still render as plain text. A previous app build can read those rows, but may convert new section types to plain text if it saves the draft. Apply the migration before deploying the new editor and prefer a forward fix over rolling back to an editor that cannot save the type.

## Section and link order

Drag **Drag to move** onto another section or link in the same group to move it into that position. The page scrolls when you drag near the top or bottom edge. Releasing outside the section list cancels the move. **Move up** and **Move down** offer the same reorder operation through the keyboard or a single click or tap. Focus follows the moved heading or link label. Dragging adds one undo step, and publishing saves the new order.

## Section locks

Select **Lock section** on a valid section to protect its fields, visibility setting, move controls and remove button. Clear the checkbox to edit again. Other sections can still move around it. The lock is an editor safeguard for the profile owner. Undo and redo include lock changes, and publication history restores the lock as part of the draft. Publishing uses the existing visibility setting and keeps the lock private.

Migration 20261110001800 stores the lock. The save RPC returns SQLSTATE 22023 for invalid lock values or if an older editor replaces sections without explicit lock settings while the draft contains a locked section.

## Section visibility

Use **Hide section from public profile** to omit a section from the public preview and the next publication. The editor keeps the section available for editing, moving or showing again. Publish to apply the change to the live page. Restoring an earlier version restores that version's visibility settings in the draft.

Migration 20261110001700 keeps hidden content in owner-only snapshots. The public profile endpoint excludes the entire hidden section, including its text and any countdown target. Hidden sections count towards the six-section limit. When a draft contains hidden sections, the save RPC rejects older clients that replace sections without explicit visibility settings.

## Countdown

Add a section, choose **Countdown**, and enter its heading, description and target date and time in UTC. Countdown sections use one of the six existing section slots. A valid target appears as a date in Studio, history and the public page. The date is readable with JavaScript disabled. With JavaScript enabled, the timer rounds up to the next minute and shows **Countdown finished.** at the target. Past targets are supported.

Migration 20261110001600 stores the UTC minute in draft and publication rows. A malformed or missing target blocks saving and the database rejects it with SQLSTATE 22023. Countdown uses the browser clock, so a device with an incorrect clock may show the wrong remaining time. The saved UTC date is the reference.

## Appearance

Studio offers Centred card, Editorial and Portfolio grid layouts. Editorial places the avatar beside the title on wider cards and stacks them on phones. Studio also offers Compact, Balanced and Airy spacing and Square, Soft and Round corners. The shared renderer applies the same named CSS values to previews and live pages. Balanced and Soft preserve the existing design. These choices change spacing and radii; profile colours and link target sizes are unaffected. The editor does not accept raw CSS or script.

In Studio → Customize → Design, use **Upload background image** to select a file directly, or **Upload background video** to add a silent looping MP4/WebM clip. The chosen image or clip appears behind the profile-card content. Only one background type can be selected at a time. Uploads remain private while editing; publishing makes the selected background visible. Image uploads refresh the draft revision before the selection is saved. The separate Image Host service remains available for image-hosting tools; there is no public profile gallery.

Migration `20261110001300_appearance_tokens.sql` checks the token names and snapshots them with the rest of the profile. An old request that omits the optional appearance argument keeps the existing choices. A restore changes the draft. Publish to make it live. Migration 20261110001400 adds the layout choice and treats older appearance settings as Centred card.

Studio's link accent control offers Mint, Rose and Ink. For these presets, the renderer selects black or white text and Studio reports the resulting contrast ratio. The presets meet the 4.5 to 1 minimum for normal link text. The default uses the active theme's link colours. Migration 20261110001500 accepts only the named accents. [WCAG 2.2 contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum)

Use **Copy or paste appearance** in Studio to copy a version 1 code or select its text manually. Paste a code and choose **Apply appearance** to change the draft's theme, layout, spacing, corners and link accent in one undoable edit. Codes exclude profile content. Invalid or unsupported codes leave the draft unchanged.

Choose **Fade in** under **Background entrance** to animate the decorative background when the card loads. The effect uses the browser's reduced-motion preference and leaves text readable throughout. The choice is saved with appearance settings and included in copied appearance codes.

The public gallery at `/templates` shows the same built-in catalogue. Its Studio links preselect the relevant preview for signed-in creators who already have a profile. Community-submitted templates are supported through the separate moderated template hub. Typed profile blocks and provider embeds are documented separately in `profile-blocks.md`, `profile-templates.md` and `youtube-widget.md`.

## Unified public page layout

Studio stores one ordered page layout for independently movable text sections, Links and Interactive widgets. The profile identity remains the page header. The former public Gallery block is removed, including from legacy saved layouts. Social URLs are presented as compact icon links; their original link destinations and provider-backed widgets remain attached to the same source links.

The layout is a reference list, not a second copy of profile content. Text section references use their current section position and are remapped when the existing section editor reorders, edits, adds or removes sections. Links and widget configuration continue to be stored by their existing systems. Uploaded image assets remain private and are used only by features such as backgrounds, audio cover art and custom icons. Guestbook, Testimonials, Poll and FAQ remain one interactive module with their existing internal widget order and APIs.

Migration `20261123215130_profile_page_layout.sql` adds a validated `page_layout` JSONB snapshot to draft and published profiles. The save RPC checks layout references against submitted sections, links and enabled widgets before calling the established revision-checked save transaction. Legacy Gallery entries are ignored by the application normaliser and are not rendered. Publication snapshots copy the remaining layout alongside other profile fields; restoring a publication restores that layout.

The Studio canvas uses the same `ProfileCard` renderer as the public profile. In preview mode, its layout handles expose cross-category drag ordering and its component surfaces open the matching existing editing panel. Public visitors never receive editor drag controls. Drag-and-drop is an enhancement; keyboard and click-based editing, the existing section/link reorder actions, save/publish controls and revision-conflict protection remain available.

Social destinations use compact, labelled profile icons where the provider is recognised. YouTube, Twitch, Spotify, GitHub/Discord metadata and Roblox-specific link rendering remain connected to their existing link entries rather than being replaced by decorative icon-only links. Interactive widget previews do not issue visitor submissions or votes.
