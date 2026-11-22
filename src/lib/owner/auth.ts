import "server-only";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/profiles-server";

export async function requireOwner() {
  const session = await requireAccount();
  const { data, error } = await session.client.rpc("is_platform_owner");
  if (error || data !== true) notFound();
  return session;
}

export function ownerQueryError(code: string) {
  return code === "42501" ? "This action requires an Owner session with verified MFA (AAL2)." :
    "The action was rejected. Check the entered values and try again.";
}
