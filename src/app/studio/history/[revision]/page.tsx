import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/shell";
import { ProfileCard } from "@/components/profile-card";
import { RestorePublication } from "@/components/restore-publication";
import { profileRevision } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";
import { publicationDate, publicationPreview } from "@/lib/publication";

export const metadata = { title: "Publication preview", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ revision: string }> }) {
  const { revision } = await params;
  const target = profileRevision.safeParse(revision);
  if (!/^\d+$/.test(revision) || !target.success) notFound();
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("get_publication", { p_revision: target.data });
  if (error) throw new Error("Couldn’t load this version.");
  if (!data) notFound();
  const publication = publicationPreview.parse(data);

  return <main className="shell narrow stack">
    <Brand />
    <Link href="/studio/history">← Publish history</Link>
    <section className="panel stack">
      <h1>Version {publication.revision}</h1>
      <p><time dateTime={publication.published_at}>{publicationDate(publication.published_at)}</time>{publication.live && " · Live"}</p>
      <ProfileCard profile={publication} preview avatarSrc={publication.avatar ? `/studio/avatar/${publication.avatar}` : undefined} />
      <RestorePublication revision={publication.revision} draftRevision={publication.draft_revision} />
    </section>
  </main>;
}
