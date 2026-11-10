# Studio sections and templates

Creators can add up to six text sections. Each has a heading of up to 80 characters and body text of up to 800 characters. Studio displays sections above the link list. Both fields must contain text before the editor will save the draft. Link order and section order are independent.

Select a template in Studio to see a private preview. Apply its colours to any draft. If the draft has no text sections, you can also add the starter sections. Applying a template is a single undoable draft edit. Existing sections, profile identity, links and avatar are preserved. The selected template preview itself never saves or publishes.

Section text is rendered as text, including line breaks and HTML-like characters. No HTML, embeds or external template assets are accepted. The built-in catalogue is defined in source. Applying a template saves only the resulting theme and text, so catalogue edits do not alter existing profiles.

Migration 20261110000800 adds relational draft and publication section tables. The revision-checked save RPC accepts an optional final section argument for compatibility with older callers. Omitting it preserves draft sections, while passing an empty array clears them. Saving, publishing and restoring sections are part of the same transactions as the rest of the profile. Public reads return only the active publication. Private history remains owner-scoped.

The public gallery at `/templates` shows the same catalogue. Its Studio links preselect the relevant preview for signed-in creators who already have a profile. Creator-submitted templates and non-text blocks remain future work.
