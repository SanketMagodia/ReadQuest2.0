/** Default site admin handle — users can message this account without friending. */
export const ADMIN_USERNAME = "readquest_admin";

/** Shown in chat and About as the team contact label. */
export const ADMIN_DISPLAY_NAME = "The Gist Club Team";

/** Server-side admin username (env override for deployments). */
export function getAdminUsername(): string {
  return (
    process.env.SUPERADMIN_USERNAME?.trim().toLowerCase() || ADMIN_USERNAME
  );
}

export function isAdminUsername(username: string): boolean {
  return username.toLowerCase() === getAdminUsername();
}
