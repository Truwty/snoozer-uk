import { socialBrandPaths } from "@/lib/social-brand-paths";
import type { SocialProviderId } from "@/lib/social-providers";

export function SocialProviderIcon({ providerId, className }: {
  providerId: SocialProviderId;
  className?: string;
}) {
  const paths = socialBrandPaths[providerId] ?? socialBrandPaths.website;

  if (!paths?.length) return null;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path, index) => <path key={index} d={path} />)}
    </svg>
  );
}
