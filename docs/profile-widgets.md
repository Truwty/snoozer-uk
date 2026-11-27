# Interactive profile widgets

**Reviewed:** 27 November 2026

Studio supports creator-managed FAQ, Testimonials, Poll and Guestbook configuration. Widget settings are saved with the normal profile draft and become public only when the corresponding revision is published. The current compact public profile intentionally does **not** render the Guestbook on the public bio page; guestbook configuration, moderation and server API code remain in the repository, but do not advertise public Guestbook display until the public renderer is updated.

## Studio

Open Studio → Widgets. Each profile can enable one of each widget type and choose their display order. Basic widgets are available on Free, Plus, Pro and Studio.

- **FAQ:** add up to ten question-and-answer pairs. Visitors can expand each question using the browser's native disclosure control.
- **Testimonials:** add up to six creator-curated quotes, author names and optional roles. Only publish feedback you have permission to use.
- **Poll:** write a question and add two to six options. Changing the question or options starts a new poll ID so earlier votes are not mixed into new results. Polls can be closed manually or at a selected time.
- **Guestbook:** owners can configure moderation and submission settings in Studio. Public display on the compact profile is currently suppressed.

## Voting and visitor privacy

Polls limit each browser token to one vote per poll. The token is random, created only when a visitor submits a message or votes, and stored in browser local storage with a separate scope for each profile Guestbook or poll. Snoozer stores only its SHA-256 hash with the interaction record. This is an abuse-prevention measure, not proof of a unique person; clearing browser storage or using another browser can allow another vote.

Widget endpoints do not request or store visitor IP addresses in widget records. Hosting and database providers may retain separate technical request logs under their own policies. Visitor messages are plain text and are never interpreted as HTML or scripts. The submission form includes a hidden honeypot field to discard basic automated submissions.

## Moderation and retention

Guestbook messages are pending by default. Only approved messages are returned by the public guestbook API. Profile owners can approve, reject or delete entries. Visitors can report an individual approved message from its **Report message** link where it is rendered; signed-in reports enter the existing Owner moderation queue with the entry reference. Reports are limited to three per verified account in a rolling 24-hour period. The account inbox receives a generic notice when a new message arrives. If the separate account-notification email dispatcher is configured and enabled, the creator may also receive a generic email notice. Neither notice contains the visitor's message, reporter details or moderation notes.

Rejected messages older than 30 days are removed opportunistically when a new submission arrives. Approved and pending messages remain until the profile owner removes them or the profile/account is deleted. Poll votes are retained with their poll; changing the poll configuration creates a separate poll identifier.

## Limitations

Polls are for informal engagement, not elections, competitions requiring verified identity or other high-stakes decisions. The one-vote rule applies to a random browser token, not to a person. Snoozer does not verify the truth or authenticity of creator-curated testimonials.
