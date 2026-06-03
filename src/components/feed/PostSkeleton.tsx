export function PostSkeleton() {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex gap-4">
        <div className="h-12 w-12 shrink-0 rounded-2xl skeleton-shimmer" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 rounded-full skeleton-shimmer" />
            <div className="h-3 w-10 rounded-full skeleton-shimmer" />
          </div>
          <div className="h-5 w-40 rounded-full skeleton-shimmer" />
          <div className="space-y-2 pt-1">
            <div className="h-4 w-full rounded skeleton-shimmer" />
            <div className="h-4 w-11/12 rounded skeleton-shimmer" />
            <div className="h-4 w-2/3 rounded skeleton-shimmer" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function PostSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
