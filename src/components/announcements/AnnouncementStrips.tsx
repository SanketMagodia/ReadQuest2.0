"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnnouncementCard,
  type AnnouncementItem,
} from "@/components/announcements/AnnouncementCard";
import { useDismissedBroadcasts } from "@/lib/hooks/useDismissedBroadcasts";

export function AnnouncementFeedStrip() {
  return <AnnouncementStrip variant="feed" />;
}

export function AnnouncementRailStrip() {
  return <AnnouncementStrip variant="rail" />;
}

function AnnouncementStrip({ variant }: { variant: "feed" | "rail" }) {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const { ready, dismiss, isVisible } = useDismissedBroadcasts();

  useEffect(() => {
    fetch("/api/announcements", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { items: AnnouncementItem[] };
        setItems(data.items ?? []);
      })
      .catch(() => {});
  }, []);

  const visible = useMemo(
    () => (ready ? items.filter((item) => isVisible(item.id)) : []),
    [items, ready, isVisible]
  );

  if (!ready || !visible.length) return null;

  if (variant === "rail") {
    return (
      <>
        {visible.map((item) => (
          <AnnouncementCard
            key={item.id}
            item={item}
            variant="rail"
            onDismiss={dismiss}
          />
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((item) => (
        <AnnouncementCard
          key={item.id}
          item={item}
          variant="feed"
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
