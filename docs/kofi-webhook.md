# Ko-fi donation webhook

In the platform Ko-fi account, set the Webhooks URL to the HTTPS deployment path /api/v1/billing/kofi/webhook. Set KOFI_WEBHOOK_TOKEN in the server environment to the verification token displayed by Ko-fi, then apply migration 20261110002800. Use the dashboard's GBP donation test to verify a successful HTTP 200 and one private receipt. Replaying that payment should leave one row. Storage errors return 503 for retry.

Snoozer stores only the message and transaction IDs, timestamps and integer pence amount. Donation receipts are unclaimed and never change account access. Membership, commission and shop event types are acknowledged and ignored. This first version accepts GBP donations only. Provider verification remains open. [Ko-fi webhook documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook)

## Creator and platform support links

In Studio, open Add Ko-fi support link, paste the direct HTTPS address for your Ko-fi profile and add it. Edit the link label and order in the Links section. The link follows the same draft, undo, publish and history workflow as other links. Visitors see Ko-fi in the link label and navigate there to make a payment. Set KOFI_PLATFORM_PROFILE_URL on the server to enable the separate platform support link in the home page footer.

Creator links do not route payments through Snoozer. The platform donation webhook remains separate. Unclaimed platform donations can be queued for manual review below.

## Manual donation review

A verified account can request a review in Studio under Plan and usage. Ask the donor for the Ko-fi transaction reference from their own receipt. The same response is returned for existing and missing receipts. Duplicate requests for the same account and reference reuse the original review. Reviews only confirm that a donation was associated with the requester. They leave plan access unchanged.

An authorised billing operator can run the service-role RPC list_pending_kofi_donation_reviews and independently verify the claimant and payment against the platform Ko-fi account. A matching reference is a lookup aid. Verify purchaser ownership through the payment provider or a trusted support channel before confirming. Call resolve_kofi_donation_review with the review UUID and true after independent confirmation, or false when declining. A delayed webhook leaves the claim pending until its receipt arrives. A confirmed receipt stays marked as used even if the requester deletes their account. Keep the service credential in the operator secret store. A staff application screen remains pending.
