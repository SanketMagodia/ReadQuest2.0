import { redirect } from "next/navigation";

/** Daily quest is gone — old bookmarks land on Gists. */
export default function DailyPage() {
  redirect("/");
}
