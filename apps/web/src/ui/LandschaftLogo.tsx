/*
 * ---metadata---
 * type: app-source
 * description: Geometric stacked-diamond logo mark for the Landschaft sidebar header.
 * last-updated: 2026-06-25
 * last-model: cursor-composer
 * last-change: added minimal landscape layer icon for v3 sidebar header
 * ---end-metadata---
 */

type LandschaftLogoProps = {
  size?: number;
};

export function LandschaftLogo({ size = 22 }: LandschaftLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className="landschaft-logo"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3.5 18.5 8 12 12.5 5.5 8 12 3.5Z"
        fill="currentColor"
        opacity="0.34"
      />
      <path
        d="M12 8.5 18.5 13 12 17.5 5.5 13 12 8.5Z"
        fill="currentColor"
        opacity="0.62"
      />
      <path d="M12 13.5 18.5 18 12 22.5 5.5 18 12 13.5Z" fill="currentColor" />
    </svg>
  );
}
