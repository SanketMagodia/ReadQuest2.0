"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PenSquare } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { SignInRequired } from "@/components/auth/SignInRequired";
import { ComposerForm } from "@/components/compose/ComposerForm";

/**
 * The standalone composer. Most people now post from the dialog on the feed;
 * this page still backs deep links like `/compose?bookId=…` from a book room
 * and the PWA shortcut.
 */
export default function ComposePage() {
  return (
    <Suspense fallback={<LoadingIndicator fullPage label="Loading…" />}>
      <ComposeScreen />
    </Suspense>
  );
}

function ComposeScreen() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const bookId = searchParams?.get("bookId") ?? undefined;

  if (status === "loading") {
    return <LoadingIndicator fullPage label="Loading…" />;
  }

  if (status === "unauthenticated") {
    return (
      <SignInRequired
        title="Sign in to compose a post"
        description="Search a book, share a quote, and publish to your profile — sign in or create a free account first."
        icon={PenSquare}
        nextPath="/compose"
        hints={[
          "Attach posts to books in our library",
          "Add text or an image",
          "Shows up on your profile and in feeds",
        ]}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">compose</p>
        <h1 className="font-display text-[30px] font-bold leading-tight">
          Craft a quote-sized post
        </h1>
        <p className="text-sm text-muted">
          Search the catalog, tag the book, publish the line that lives
          rent-free in your head.
        </p>
      </header>

      <ComposerForm
        initialBookId={bookId}
        onPublished={(post) => router.push(`/post/${post.id}`)}
      />
    </div>
  );
}
