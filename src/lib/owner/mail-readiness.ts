import "server-only";
import {zohoSmtpConfigured} from "./zoho-transport";

/** Render Free blocks outbound SMTP on ports 25, 465 and 587.
 * Enable this only after the hosting tier permits outbound SMTP and a
 * controlled Zoho delivery test has been planned. Fail closed by default. */
export function zohoOutboundEnabled(){
 return process.env.ZOHO_SMTP_OUTBOUND_ENABLED==="true";
}

export function zohoMailReady(){
 return zohoSmtpConfigured() && zohoOutboundEnabled();
}

export function mailReadiness(){
 return {
  credentialsConfigured:zohoSmtpConfigured(),
  outboundEnabled:zohoOutboundEnabled(),
  dispatchTokenConfigured:typeof process.env.OWNER_EMAIL_DISPATCH_TOKEN==="string" &&
    process.env.OWNER_EMAIL_DISPATCH_TOKEN.length>=32,
 };
}
