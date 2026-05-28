export function canDeleteContent(
  viewer: { id: string; role?: string } | undefined,
  authorId: string
) {
  if (!viewer?.id) return false;
  if (viewer.role === "admin") return true;
  return viewer.id === authorId;
}
