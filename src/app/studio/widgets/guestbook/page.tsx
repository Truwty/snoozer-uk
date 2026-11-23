import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readStudioDraft, studioHref, type StudioProfileQuery, requireAccount } from "@/lib/profiles-server";
import { moderateGuestbookEntry, deleteGuestbookEntry } from "./actions";

export const metadata = { title: "Guestbook moderation · Studio", robots: { index: false, follow: false } };
const queueSchema = z.array(z.strictObject({
  id: z.uuid(), displayName: z.string(), message: z.string(),
  status: z.enum(["pending","approved","rejected"]), createdAt: z.iso.datetime({ offset: true }),
}));

export default async function GuestbookModeration({ searchParams }: {
  searchParams: Promise<StudioProfileQuery & { status?: string }>;
}) {
  const { client } = await requireAccount();
  const { profile, status } = await searchParams;
  const draft = await readStudioDraft(profile);
  if (!draft) redirect("/studio");
  const { data, error } = await client.rpc("owner_guestbook_queue", { p_profile: draft.profile_id, p_limit: 100 });
  const entries = queueSchema.safeParse(data);
  return <main className="shell stack">
    <Link href={studioHref("/studio", draft.profile_id)}>← Back to Studio</Link>
    <p className="eyebrow">STUDIO / WIDGETS</p>
    <h1>Guestbook moderation</h1>
    <p className="muted">New messages stay private until you approve them. Rejected messages are not shown on your public profile.</p>
    {status === "approved" && <p role="status">Message approved and published.</p>}
    {status === "rejected" && <p role="status">Message rejected.</p>}
    {status === "deleted" && <p role="status">Message deleted.</p>}
    {status === "error" && <p role="alert">The moderation action could not be completed. Reload and try again.</p>}
    {error || !entries.success ? <p role="alert">The Guestbook queue is unavailable.</p> : entries.data.length === 0
      ? <section className="panel"><p>No Guestbook messages yet.</p></section>
      : <div className="guestbook-moderation-list">{entries.data.map((entry) => <article className="panel stack" key={entry.id}>
        <header className="actions"><strong>{entry.displayName}</strong><span className="widget-status">{entry.status}</span></header>
        <p>{entry.message}</p>
        <time className="muted" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("en-GB")}</time>
        <div className="actions">
          {entry.status === "pending" && <>
            <form action={moderateGuestbookEntry}><input type="hidden" name="profile" value={draft.profile_id}/><input type="hidden" name="entry" value={entry.id}/><input type="hidden" name="status" value="approved"/><button className="button small primary">Approve</button></form>
            <form action={moderateGuestbookEntry}><input type="hidden" name="profile" value={draft.profile_id}/><input type="hidden" name="entry" value={entry.id}/><input type="hidden" name="status" value="rejected"/><button className="button small">Reject</button></form>
          </>}
          <form action={deleteGuestbookEntry}><input type="hidden" name="profile" value={draft.profile_id}/><input type="hidden" name="entry" value={entry.id}/><button className="button small">Delete</button></form>
        </div>
      </article>)}</div>}
  </main>;
}
