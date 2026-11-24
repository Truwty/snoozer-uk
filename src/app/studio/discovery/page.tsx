import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount, readStudioDraft, type StudioProfileQuery } from "@/lib/profiles-server";
import { discoveryCategories, discoveryTags } from "@/lib/discovery";
import { saveDiscoverySettings } from "./actions";
import { DiscoveryProfileCard } from "@/components/discovery-profile-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile discovery settings", robots: { index: false, follow: false } };

type Search = StudioProfileQuery & { status?: string };

export default async function StudioDiscoveryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const draft = await readStudioDraft(params.profile);
  if (!draft) notFound();
  const { client } = await requireAccount();
  const result = await client.rpc("get_my_discovery_settings", { p_profile: draft.profile_id });
  const settings = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : {};
  const tags = Array.isArray(settings.tags) ? settings.tags.filter((value): value is string => typeof value === "string") : [];
  const directoryEnabled = settings.directory_enabled === true;
  const leaderboardEnabled = settings.leaderboard_enabled === true;
  const recommendationsEnabled = settings.recommendations_enabled === true;
  return <main className="shell studio-shell discovery-settings-page">
    <header className="studio-page-heading">
      <div><p className="eyebrow">PROFILE / DISCOVERY</p><h1>Discovery settings</h1>
        <p className="muted">Choose how your published profile appears in the Snoozer creator directory.</p></div>
      <div className="actions"><Link className="button small" href={"/" + draft.username}>View profile ↗</Link><Link className="button small" href="/discover">Open Discover ↗</Link></div>
    </header>
    {params.status === "saved" && <p className="message" role="status">Your discovery preferences have been saved.</p>}
    {params.status === "failed" && <p className="message error" role="alert">Could not save discovery settings. Your profile may have changed or the request was rejected.</p>}
    {params.status === "invalid" && <p className="message error" role="alert">Check your category and choose no more than five interests.</p>}
    {result.error && <p className="message error" role="alert">Discovery settings are temporarily unavailable. Reload to try again.</p>}
    <section className="studio-dashboard-panel stack" aria-labelledby="discovery-preview-title">
      <p className="eyebrow">PUBLIC LISTING PREVIEW</p>
      <h2 id="discovery-preview-title">How your creator card will look</h2>
      <p className="muted">This preview uses your current published profile details and the category/interests below. It will appear in Discover only when your profile is published and you opt in.</p>
      <div className="discovery-preview-card">
        <DiscoveryProfileCard profile={{
          username: draft.username,
          display_name: draft.display_name,
          bio: draft.bio,
          avatar: draft.avatar,
          category: typeof settings.category === "string" ? settings.category : "other",
          tags: tags.slice(0, 5),
          has_verified_domain: Boolean(draft.custom_domain),
        }}/>
      </div>
    </section>
    <form action={saveDiscoverySettings} className="discovery-settings-form">
      <input type="hidden" name="profile" value={draft.profile_id}/>
      <input type="hidden" name="username" value={draft.username}/>
      <section className="studio-dashboard-panel stack">
        <p className="eyebrow">PUBLIC DIRECTORY</p><h2>Show my profile in Discover</h2>
        <p className="muted">When enabled, your published name, avatar, bio, category and selected interests can appear in public creator search, category pages and curated collections. This does not change whether your profile URL itself is public.</p>
        <label className="discovery-toggle-row"><input type="checkbox" name="directory_enabled" defaultChecked={directoryEnabled}/><span><strong>Allow my profile to appear in Discover</strong><small>Off by default. You can remove your listing at any time.</small></span></label>
        <p className="muted">{draft.published_revision === null ? "Publish your profile before it can appear in the public directory." : directoryEnabled ? "Your profile is eligible for directory listing when it is published and unrestricted." : "Your profile is currently excluded from the public directory."}</p>
      </section>
      <section className="studio-dashboard-panel stack">
        <p className="eyebrow">CLASSIFICATION</p><h2>Category and interests</h2>
        <label>Primary category
          <select name="category" defaultValue={typeof settings.category === "string" ? settings.category : "other"}>
            {discoveryCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <fieldset className="discovery-tag-picker">
          <legend>Interests (choose up to five)</legend>
          <div className="discovery-tag-options">
            {discoveryTags.map((value) => <label key={value}><input type="checkbox" name="tag" value={value} defaultChecked={tags.includes(value)}/><span>{value.replaceAll("-", " ")}</span></label>)}
          </div>
        </fieldset>
      </section>
      <section className="studio-dashboard-panel stack">
        <p className="eyebrow">OTHER DISCOVERY CONTROLS</p><h2>Audience preferences</h2>
        <label className="discovery-toggle-row"><input type="checkbox" name="recommendations_enabled" defaultChecked={recommendationsEnabled}/><span><strong>Include my profile in related creators</strong><small>Only public discovery profiles with this option enabled can be recommended beside similar creators.</small></span></label>
        <label className="discovery-toggle-row"><input type="checkbox" name="leaderboard_enabled" defaultChecked={leaderboardEnabled}/><span><strong>Show my profile on the Views Leaderboard</strong><small>Independent of search-engine indexing. Existing preferences are preserved until you change this setting.</small></span></label>
      </section>
      <div className="actions"><button className="button primary" type="submit" disabled={Boolean(result.error || !result.data)}>Save discovery settings</button></div>
    </form>
  </main>;
}
