# Ko-fi donation webhook

In the platform Ko-fi account, set the Webhooks URL to the HTTPS deployment path /api/v1/billing/kofi/webhook. Set KOFI_WEBHOOK_TOKEN in the server environment to the verification token displayed by Ko-fi, then apply migration 20261110002800. Use the dashboard's GBP donation test to verify a successful HTTP 200 and one private receipt. Replaying that payment should leave one row. Storage errors return 503 for retry.

Snoozer stores only the message and transaction IDs, timestamps and integer pence amount. Donation receipts are unclaimed and never change account access. Membership, commission and shop event types are acknowledged and ignored. This first version accepts GBP donations only. Provider verification and creator-facing support links remain open. [Ko-fi webhook documentation](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook)
