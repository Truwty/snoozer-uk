import {z} from "zod";
import {inspectMembershipInvoice,inspectMembershipSubscription} from "./creator-membership-provider";
import type {MemberRecord} from "./creator-membership-subscription";

/**
 * Provider-authored invoice PDFs are not automatically compliant tax invoices.
 * Never construct an invoice URL from buyer input or stored metadata.
 */
export function verifiedStripeTestInvoicePdf(
 invoice:unknown,member:MemberRecord,period:ReturnType<typeof inspectMembershipSubscription>,
) {
 const id=inspectMembershipInvoice(invoice,member,period);
 const {invoice_pdf:pdf}=z.object({id:z.literal(id),invoice_pdf:z.string().url().max(2048)}).parse(invoice);
 const target=new URL(pdf);
 // member.accountId comes from the strict acct_ identifier schema, not user text.
 const path=new RegExp("^/invoice/"+member.accountId+"/test_[A-Za-z0-9_-]+/pdf$");
 if(target.protocol!=="https:"||target.hostname!=="pay.stripe.com"||target.host!=="pay.stripe.com"
  ||target.username||target.password||target.hash||!path.test(target.pathname))
  throw new Error("Unsupported Stripe invoice PDF destination.");
 return target.toString();
}
