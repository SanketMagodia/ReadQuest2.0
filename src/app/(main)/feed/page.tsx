import { Library } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { SignInRequired } from "@/components/auth/SignInRequired";
import FeedPage from "../page";

export default async function FeedRoute() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return (
      <SignInRequired
        title="Sign in to see your Feed"
        description="Your personalized feed pulls from readers and books you follow — available once you're signed in."
        icon={Library}
        nextPath="/feed"
        hints={[
          "Posts from books and readers you follow",
          "For You and Latest modes",
          "Free account — takes under a minute",
        ]}
      />
    );
  }
  return <FeedPage />;
}
