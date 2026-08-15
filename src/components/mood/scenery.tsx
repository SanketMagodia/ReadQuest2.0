/**
 * Scenery primitives shared by the profile Top Shelf and the Explore header's
 * mood atmosphere. They live here rather than inside either surface so the sun
 * and moon can't drift apart between the two.
 *
 * Size and tone are props, not classes folded into `className`: Tailwind emits
 * `h-16` after `h-11`, so passing `h-11` through `className` would silently
 * lose to the default and every sun would render the same size.
 */

export function Sun({
  className,
  sizeClass = "h-16 w-16",
  toneClass = "text-amber-400",
}: {
  className?: string;
  sizeClass?: string;
  toneClass?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={`tgc-sun absolute ${sizeClass} ${toneClass} ${className ?? ""}`}
    >
      <circle cx="32" cy="32" r="12" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M32 6v9M32 49v9M6 32h9M49 32h9M13.6 13.6l6.4 6.4M44 44l6.4 6.4M50.4 13.6L44 20M20 44l-6.4 6.4" />
      </g>
    </svg>
  );
}

export function Moon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute rounded-full ${className ?? ""}`}
      style={{
        background: "radial-gradient(circle at 36% 34%, #f7f3df 0%, #ddd7ba 65%, #c9c2a2 100%)",
        boxShadow: "0 0 26px 8px rgba(245,240,214,0.22)",
      }}
    >
      <span className="absolute left-[28%] top-[42%] h-2 w-2 rounded-full bg-stone-400/40" />
      <span className="absolute left-[60%] top-[24%] h-1.5 w-1.5 rounded-full bg-stone-400/40" />
      <span className="absolute left-[52%] top-[64%] h-1.5 w-1.5 rounded-full bg-stone-400/30" />
    </span>
  );
}

/**
 * The sun barely making it through a cloud bank — used where the scene is
 * overcast and a hard-edged sun would be wrong.
 */
export function VeiledSun({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute rounded-full ${className ?? ""}`}
      style={{
        background: "radial-gradient(circle, rgba(226,232,240,0.5), transparent 70%)",
      }}
    />
  );
}
