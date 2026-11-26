import { redirect } from "next/navigation";

export const metadata = { title: "Owner", robots: { index: false, follow: false } };

export default function DisabledOwnerBadgesPage(): never {
  redirect("/owner");
}
