import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { FriendsClient } from "./FriendsClient";

export const metadata = {
  title: "Friends · Readquest",
};

export default async function FriendsPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    redirect("/login?next=/friends");
  }
  return (
    <section className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-0">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted">
          See what your friends are reading and find new readers to connect
          with.
        </p>
      </header>
      {/* useSearchParams inside FriendsClient requires a Suspense boundary
          per the Next.js 16 docs — without it, the route falls back to full
          client-side rendering during build. */}
      <Suspense fallback={null}>
        <FriendsClient />
      </Suspense>
    </section>
  );
}
