import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { NotificationsList } from "./NotificationsList";

import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Notifications"),
};

export default async function NotificationsPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    redirect("/login?next=/notifications");
  }
  return (
    <section className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-0">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted">
          Replies, likes and activity from books you follow.
        </p>
      </header>
      <NotificationsList />
    </section>
  );
}
