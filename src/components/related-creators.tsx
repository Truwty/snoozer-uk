import { discoveryProfiles } from "@/lib/discovery";
import { discoveryRequestFingerprint, discoveryServerClient } from "@/lib/discovery-server";
import { DiscoveryProfileCard } from "@/components/discovery-profile-card";

export async function RelatedCreators({ username }: { username: string }) {
  try {
    const fingerprint = await discoveryRequestFingerprint();
    const client = await discoveryServerClient();
    const response = await client.rpc("get_related_creators", {
      p_username: username, p_limit: 6, p_request_fingerprint: fingerprint,
    });
    const parsed = discoveryProfiles.safeParse(response.data);
    if (response.error || !parsed.success || parsed.data.length === 0) return null;
    return <section className="related-creators" aria-labelledby="related-creators-title">
      <div className="discovery-section-heading"><div><p className="eyebrow">KEEP EXPLORING</p><h2 id="related-creators-title">More creators like this</h2></div></div>
      <div className="discovery-profile-grid">
        {parsed.data.map((profile) => <DiscoveryProfileCard key={profile.username} profile={profile}/>)}
      </div>
    </section>;
  } catch {
    return null;
  }
}
