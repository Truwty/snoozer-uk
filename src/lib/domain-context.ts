import { domainName } from "./domains";
import { username } from "./profile";

export const domainHostHeader = "x-snoozer-domain-host";
export const domainUserHeader = "x-snoozer-domain-username";
export function publicDomainContext(request: Request, platformOrigin: string) {
  const host = domainName.safeParse(request.headers.get(domainHostHeader));
  const name = username.safeParse(request.headers.get(domainUserHeader));
  return host.success && name.success && new URL(platformOrigin).hostname !== host.data && new URL(request.url).hostname === host.data
    ? { host: host.data, username: name.data } : null;
}
