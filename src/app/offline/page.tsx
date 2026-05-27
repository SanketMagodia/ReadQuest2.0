export const dynamic = "force-static";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div
        className="rounded-2xl p-px"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="rounded-[14px] bg-card px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          You are offline
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        No connection right now
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        Readquest needs the network to load fresh quotes and threads. We&apos;ll
        reconnect automatically — try again in a moment.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-pop)]"
        style={{ background: "var(--gradient-brand)" }}
      >
        Try again
      </a>
    </main>
  );
}
