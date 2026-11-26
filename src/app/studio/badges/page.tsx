import { redirect } from "next/navigation";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

export default function DisabledBadgesPage(): never {
  redirect("/studio");
}
