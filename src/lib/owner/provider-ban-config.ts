import "server-only";
import {zohoSmtpConfigured} from "./zoho-transport";
export function providerBanConfigured(){
 return process.env.SNOOZER_ENABLE_AUTH_BANS==="true" &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && zohoSmtpConfigured();
}
