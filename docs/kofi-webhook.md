# Ko-fi platform donation webhook

**Reviewed:** 27 November 2026

This is an optional **platform donation receipt** integration. It is separate from Snoozer Premium subscriptions, does not grant account access or Premium entitlements, and is not a creator marketplace or seller-payment feature.

In the platform Ko-fi account, set the webhook URL to the HTTPS deployment path `/api/v1/billing/kofi/webhook`. Set `KOFI_WEBHOOK_TOKEN` in the server environment to the verification token displayed by Ko-fi. Apply the original receipt migration `20261110002800_kofi_donations` and currency migration `20261110005400_kofi_receipt_currency` through the repository migration chain. Use the dashboard's single-tip test to verify a successful HTTP 200 and one private receipt. Replaying that payment should leave one row. Storage errors return 503 for retry.

Snoozer stores only the message and transaction IDs, timestamps and amount in integer minor units with the original currency. Donation receipts are unclaimed and never change account access. Membership, commission and shop event types are acknowledged and ignored. The receiver accepts GBP and USD donations. Migration `20261110005400` preserves older receipts as GBP. [Ko-fi webhook documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook)

## Creator and platform support links

In Studio, open the profile editor and select **Links**. Under **Social profiles**, choose the **Support** category and select **Ko-fi**. Snoozer adds a normal profile link with the Ko-fi address prefilled; replace it with your direct profile URL and edit the link label as needed. Visitors navigate directly to the creator's Ko-fi page; creator payments do not pass through Snoozer. Set `KOFI_PLATFORM_PROFILE_URL` on the server to enable the separate platform support link in the home page footer.

Creator links do not route payments through Snoozer. The platform donation webhook remains separate. Unclaimed platform donations can be queued for manual review below.

## Manual donation review

A verified account can request a review in Studio under Plan and usage. Ask the donor for the Ko-fi transaction reference from their own receipt. The same response is returned for existing and missing receipts. Duplicate requests for the same account and reference reuse the original review. Reviews only confirm that a donation was associated with the requester. They leave plan access unchanged.

An authorised billing operator can run the service-role RPC `list_pending_kofi_donation_reviews` and independently verify the claimant and payment against the platform Ko-fi account. A matching reference is a lookup aid. Verify purchaser ownership through the payment provider or a trusted support channel before confirming. Call `resolve_kofi_donation_review` with the review UUID and `true` after independent confirmation, or `false` when declining. A delayed webhook leaves the claim pending until its receipt arrives. A confirmed receipt stays marked as used even if the requester deletes their account. Keep the service credential in the operator secret store. A dedicated staff application screen is not documented as delivered; use the authorised operator workflow.

Run `npm run billing:preflight -- kofi` from the isolated operator environment to check the local Ko-fi configuration and Supabase diagnostic access independently of Stripe. Then use **Send single tip test** in the Ko-fi dashboard. The preflight itself does not send or verify a provider delivery.

## Security notes

The receiver validates the form-encoded request, bounds the raw body, parses one JSON payload and compares the verification token using a constant-time digest comparison. It validates event type, currency, amount, IDs and timestamp before writing a receipt. Never put the Ko-fi token in a public variable, a profile field, a URL or client-side code.
