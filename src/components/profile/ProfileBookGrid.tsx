"use client";

import Image from "next/image";
import Link from "next/link";

export type ShelfBook = {
  id: string;
  slug?: string;
  title: string;
  authors?: string;
  thumbnail?: string;
};

export function ProfileBookGrid({
  books,
  emptyLabel,
  actions,
}: {
  books: ShelfBook[];
  emptyLabel: string;
  actions?: (book: ShelfBook) => React.ReactNode;
}) {
  if (!books.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul
      role="list"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
    >
      {books.map((b) => {
        const author = (b.authors || "").split(/[,;]/)[0]?.trim() || "";
        return (
          <li key={b.id}>
            <div className="group flex h-full flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-2.5 sm:p-3">
              <Link
                href={`/book/${b.slug || b.id}`}
                title={b.title}
                className="outline-none transition hover:-translate-y-0.5 hover:border-border hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-sky-400/70"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-pill ring-1 ring-border/60">
                  {b.thumbnail ? (
                    <Image
                      src={b.thumbnail.replace(/^http:/, "https:")}
                      alt={b.title}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 180px"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <span className="text-2xl font-black text-white drop-shadow-sm">
                        {b.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="line-clamp-3 text-[11px] font-semibold leading-tight text-white/90">
                        {b.title}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 flex min-h-[42px] flex-col gap-0.5 px-0.5">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground">
                    {b.title}
                  </p>
                  {author ? (
                    <p className="line-clamp-1 text-[11px] text-muted">
                      by {author}
                    </p>
                  ) : null}
                </div>
              </Link>
              {actions ? <div className="mt-auto">{actions(b)}</div> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
