# Custom profile blocks

The Studio Page Builder supports native typed profile blocks alongside existing profile sections, social links, gallery content and interactive widgets. Blocks use a fixed schema and server-rendered React components. Arbitrary HTML, CSS and JavaScript are not accepted.

## Available blocks

| Block | Content |
| --- | --- |
| Heading | One short page heading with large or small hierarchy |
| About | A heading and a bounded paragraph |
| Callout | A heading, message and neutral/accent/info/success/warning tone |
| Quote | A quote with optional attribution |
| Project | A title, description, safe public URL and button label |
| Skills | A heading and up to 20 short skill labels |
| Call to action | A heading, message, button label and safe public URL |
| Divider | Line, dotted line or spacing divider |
| Countdown | A heading and an explicit timezone-aware target timestamp |
| Statistics | A heading and up to six label/value pairs |

A profile can contain up to 32 blocks. Each block has a generated UUID, visibility and lock state, width (full, half or third), alignment (start, centre or end), and a presentation variant (plain, surface, outline or accent). Content fields are bounded by the database validator as well as their browser controls.

## Editing and ordering

Open Studio → Page Builder and add a block from the library. Select a block to open its editing fields in the Blocks panel. The page preview is also an ordering surface: use the drag handle to reposition blocks, or the move-up/move-down controls for a keyboard-accessible alternative. The library supports both drag-to-add and click-to-add.

A hidden block remains in the draft and publication history but is omitted from the public profile and its public layout. A locked block cannot be edited or removed until it is unlocked. Width, alignment and presentation can still be changed as layout properties.

## Save and publication model

The editor submits blocks through the revision-checked public.save_profile RPC. The database validates:
- the maximum block count, unique UUIDs and supported block types;
- required fields, lengths, permitted enum values and unknown-key rejection;
- safe absolute HTTP(S) project/action URLs and timezone-aware countdown timestamps;
- consistency between visible blocks and their entries in the ordered page layout.

Drafts are stored on snoozer.profiles.blocks. Each immutable publication captures a corresponding snoozer.published_profiles.blocks snapshot. Restoring a publication restores the matching block snapshot and layout. Public snapshot reads omit hidden blocks and their page-layout references.

The migration retains the older 14-argument public.save_profile signature. Existing clients that do not send a blocks parameter preserve the current saved blocks instead of erasing them.

## Verification

The implementation is covered by:
- tests/profile-blocks.test.ts for typed defaults, field bounds, safe URLs, unsupported fields, duplicate IDs and page limits;
- tests/profile-layout.test.ts for ordering, distinct block references and hidden-block omission;
- tests/database.test.ts for draft saving, publication snapshots, hidden-block filtering, restoration and legacy RPC compatibility;
- the Studio Playwright journey in e2e/supabase.spec.ts for add, edit, save, reload, publish and public rendering.

Run npm test for the unit/database suite and npm run test:e2e -- --workers=2 for the browser journey. Database tests apply the repository migrations to disposable embedded PostgreSQL; they do not mutate the hosted Supabase project.