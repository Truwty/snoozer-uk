# Custom profile domains

**Reviewed:** 27 November 2026  
**Status:** DNS and provider-verification paths are implemented. Provider capacity and live domain associations must be checked in the Render dashboard before an operator action.

## How verification works

A creator can request a custom hostname for a published profile. Snoozer does not purchase domains or automatically provision paid resources. The association is operator-managed within the existing Render service's custom-domain capacity.

The verification sequence requires:
1. A fresh, owner-scoped DNS TXT challenge under `_snoozer.<hostname>`.
2. A valid hostname and a current pending request/lease in the database.
3. A read-only Render API check confirming that the hostname is associated with the expected web service and provider reports it verified.
4. Safe public DNS answers, expected Render addressing and an HTTPS challenge request pinned to a validated IPv4 address.
5. A valid first-party `.well-known/snoozer-domain` marker response.

The server rejects redirects, untrusted/private IP destinations, unexpected IPv6 answers and unbounded responses. HTTPS certificate validation remains enabled. Verification requests have short timeouts and do not follow redirects.

## Routing and privacy boundaries

The proxy removes inbound Snoozer-internal headers before resolving a custom hostname. It sets trusted internal host/profile context only after validating the request Host against the database mapping.

On a custom profile host:
- the root may render only the matching published profile;
- public assets and explicitly supported public widget/analytics routes are bound to that profile;
- Studio, account, authentication, billing, Owner, server actions and unrelated profile routes are denied;
- canonical profile metadata uses the database-verified domain, not an untrusted Host value.

A domain verification marker is public and contains no secret. DNS challenge values are temporary and scoped to the active request.

## Disconnect and reassignment

Disconnect stops routing immediately and uses a bounded provider-removal workflow. A binding is not made available for takeover until the existing Render association is confirmed removed. This avoids stale cleanup deleting a newer association.

Unpublish, account restriction and domain disconnect are distinct states. Do not infer that a hostname is safe to reassign merely because an owner's UI says a request was cancelled.

## Operator procedure

Before manually adding or removing a Render custom domain:

1. Confirm the current Snoozer web-service ID and the intended hostname.
2. Verify the owner has a fresh DNS challenge for that exact host.
3. Confirm available workspace domain capacity in the Render dashboard.
4. Use the read-only scoped Render credential held in the server environment.
5. Apply only the requested provider association.
6. Verify the domain status, TLS certificate and marker from the owner flow.
7. On removal, wait for provider 404 and verify the parent service remains accessible before completing the database cleanup.

Never store the Render API credential in source, chat, URLs or client-side configuration. Do not attempt automatic purchases or add a wildcard domain without a separate approved design.

## Current operational note

The connected main Render service is `snoozer-uk-staging` (`srv-dbts6jon74is73en2rjg`), Frankfurt, Free. Its actual custom-domain capacity and active hostname associations should be checked in Render at the time of an operation. Historical QA hostname and capacity snapshots in earlier versions of this document are not current inventory.

## Implementation references

- `src/lib/domain-verification.ts`
- `src/lib/domains-server.ts`
- `src/lib/domain-context.ts`
- `src/proxy.ts`
- `supabase/migrations/*profile_domains*`
- `tests/domain-verification.test.ts` and database/E2E coverage
