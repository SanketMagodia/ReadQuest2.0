/**
 * Prefer setting NEXTAUTH_SECRET in production — this helper only fills a fixed dev fallback.
 */
export function getAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ?
      "readquest-dev-secret-do-not-deploy-please-32-characters"
      : undefined)
  );
}
