import "server-only";
export function providerBanConfigured(){
 return process.env.SNOOZER_ENABLE_AUTH_BANS==="true" &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY &&
   process.env.BREVO_API_KEY && process.env.SNOOZER_NOTIFICATION_FROM);
}
