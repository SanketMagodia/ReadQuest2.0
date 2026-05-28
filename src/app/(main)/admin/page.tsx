import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = {
  title: "Admin · Readquest",
};

export default async function AdminPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    redirect("/login?next=/admin");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }
  return <AdminDashboard />;
}
