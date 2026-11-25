type BadgeArtworkProps = {
  slug: string;
  size?: number;
  className?: string;
};

/** Crisp, consistent vector artwork shared by badge cards and public profiles. */
export function BadgeArtwork({ slug, size = 32, className }: BadgeArtworkProps) {
  const safeSlug = /^[a-z0-9][a-z0-9-]{1,63}$/.test(slug) && !slug.startsWith("owner-")
    ? slug
    : "unique";

  return (
    <svg
      className={["badge-artwork", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <use href={"/badges/snoozer-badges.svg#badge-" + safeSlug} />
    </svg>
  );
}
