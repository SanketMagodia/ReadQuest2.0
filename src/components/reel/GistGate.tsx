"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { ShelfLoadingStage } from "@/components/ui/ShelfLoadingStage";

type ShelfCover = {
  id: string;
  title: string;
  thumbnail: string;
};

const LINES = [
  "Shuffling a shelf with your name on it",
  "Looking for a first page worth staying on",
  "The next book is already leaning in",
  "One gist, then another is waiting underneath",
];

const SPINES = [
  "from-sky-400 to-indigo-500",
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-teal-600",
  "from-fuchsia-400 to-violet-600",
  "from-orange-400 to-red-500",
  "from-cyan-400 to-blue-600",
];

/** A handful of jackets for the lobby and the loading shelf. Decorative only. */
function useShelfCovers() {
  const [covers, setCovers] = useState<ShelfCover[]>([]);

  useEffect(() => {
    let cancel = false;
    void fetch("/api/books?sort=rating&limit=18")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { books?: Array<{ id?: string; title?: string; thumbnail?: string }> } | null) => {
        if (cancel || !data?.books) return;
        const next = data.books
          .filter((book) => book.id && book.thumbnail)
          .slice(0, 14)
          .map((book) => ({
            id: book.id as string,
            title: book.title || "Book",
            thumbnail: (book.thumbnail as string).replace(/^http:/, "https:"),
          }));
        setCovers(next);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  return covers;
}

function looped(covers: ShelfCover[]) {
  const row = covers.length >= 8 ? covers : [...covers, ...covers, ...covers];
  return [...row, ...row];
}

function CoverFace({ cover, tall }: { cover: ShelfCover; tall?: boolean }) {
  return (
    <div
      className={
        tall
          ? "h-40 w-[6.75rem] shrink-0 overflow-hidden rounded-lg shadow-[0_14px_30px_-18px_rgba(15,23,42,0.7)] ring-1 ring-black/10"
          : "h-28 w-[4.6rem] shrink-0 overflow-hidden rounded-md shadow-[0_10px_24px_-16px_rgba(15,23,42,0.65)] ring-1 ring-black/10"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.thumbnail} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function Spine({ index, tall }: { index: number; tall?: boolean }) {
  return (
    <div
      aria-hidden
      className={`shrink-0 rounded-md bg-gradient-to-b ${SPINES[index % SPINES.length]} ${
        tall ? "h-40 w-[6.75rem]" : "h-28 w-[4.6rem]"
      } opacity-80 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.65)]`}
    />
  );
}

function ShelfRow({
  covers,
  reverse = false,
  duration,
  tall = false,
}: {
  covers: ShelfCover[];
  reverse?: boolean;
  duration: string;
  tall?: boolean;
}) {
  const spines = [...Array.from({ length: 8 }, (_, i) => i), ...Array.from({ length: 8 }, (_, i) => i)];
  return (
    <div className="overflow-hidden">
      <div
        className="animate-marquee flex w-max gap-3 px-1.5"
        style={{
          animationDuration: duration,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {covers.length
          ? looped(covers).map((cover, i) => (
              <CoverFace key={`${cover.id}-${i}`} cover={cover} tall={tall} />
            ))
          : spines.map((n, i) => <Spine key={i} index={n} tall={tall} />)}
      </div>
    </div>
  );
}

/** What you see while the first gist is still on its way. No cover fetches. */
export function GistLoadingStage() {
  return (
    <ShelfLoadingStage
      className="rq-reel"
      tall
      lines={LINES}
      hint="Your first gist is almost open."
    />
  );
}

/** Signed-out gist page: a moving shelf, then a reason to come inside. */
export function GistLobby() {
  const covers = useShelfCovers();

  return (
    <div className="rq-reel flex flex-col overflow-hidden">
      <div aria-hidden className="shrink-0 space-y-3 py-3">
        <ShelfRow covers={covers} duration="42s" />
        <ShelfRow covers={[...covers].reverse()} reverse duration="52s" />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
            Free to join
          </p>
          <h1
            className="mt-2 text-[1.85rem] font-semibold leading-tight tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-reading-serif), Georgia, serif" }}
          >
            The next page is already waiting.
          </h1>
          <p className="mx-auto mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">
            Gists open on the first page. Swipe and another book is already
            underneath. Make a free account and that shelf is picked for you.
          </p>
          <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
            <Link
              href="/register"
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-pop)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              Create a free account
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-hover"
            >
              Sign in
            </Link>
          </div>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
          >
            <Compass size={13} aria-hidden />
            Or browse the library first
          </Link>
        </div>
      </div>
    </div>
  );
}
