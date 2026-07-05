import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { AdminDashboard } from "./AdminDashboard";

import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Admin"),
};

export default async function AdminPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }
  return <AdminDashboard />;
}
