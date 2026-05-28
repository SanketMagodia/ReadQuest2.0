/**
 * Prefer setting NEXTAUTH_SECRET in production — this helper only fills a fixed dev fallback.
 *
 * Note: middleware.ts must reference `process.env.NEXTAUTH_SECRET` directly
 * (not via this helper alone) so Next.js inlines it into the edge bundle.
 */
export function getAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ?
      "readquest-dev-secret-do-not-deploy-please-32-characters"
      : undefined)
  );
}
