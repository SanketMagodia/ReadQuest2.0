"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Attach the returned ref to a sentinel element near the end of the list.
 * When it scrolls into view, `onLoadMore` fires (if not already loading and `hasMore`).
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  rootMargin = "600px 0px",
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  rootMargin?: string;
}) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fnRef = useRef(onLoadMore);
  fnRef.current = onLoadMore;

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && hasMore && !loading) {
              fnRef.current();
              break;
            }
          }
        },
        { rootMargin }
      );
      observerRef.current.observe(node);
    },
    [hasMore, loading, rootMargin]
  );

  return sentinelRef;
}
