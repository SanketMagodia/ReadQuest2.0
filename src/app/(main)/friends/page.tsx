import { Suspense } from "react";
import { Users } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { FriendsClient } from "./FriendsClient";
import { SignInRequired } from "@/components/auth/SignInRequired";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Friends"),
};

export default async function FriendsPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return (
      <SignInRequired
        title="Sign in to connect with readers"
        description="Add friends, see what they're reading, and message them — all inside TGC."
        icon={Users}
        nextPath="/friends"
        hints={[
          "Find readers by username",
          "See what friends are reading now",
          "Message friends from the chat bubble",
        ]}
      />
    );
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
      <Suspense fallback={null}>
        <FriendsClient />
      </Suspense>
    </section>
  );
}
