import { requireOwner } from "@/lib/owner/auth";
import { OwnerMfa } from "@/components/owner-mfa";
export default async function OwnerSecurity() {
 const {client}=await requireOwner();
 const {data:assurance}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 const {data:factors}=await client.auth.mfa.listFactors();
 const verifiedFactorId=factors?.totp?.find(f=>f.status==="verified")?.id;
 return <main className="stack"><h1>Owner security</h1>
 <p>Administrative writes require an authenticated Owner session at assurance level AAL2. Signing in normally is not enough.</p>
 <p className="panel">Current session: <strong>{assurance?.currentLevel??"unknown"}</strong></p>
 {assurance?.currentLevel==="aal2"?<p role="status">Your session is MFA verified.</p>:<OwnerMfa verifiedFactorId={verifiedFactorId}/>}
 </main>;
}
