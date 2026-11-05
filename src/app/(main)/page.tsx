import { Source_Serif_4 } from "next/font/google";
import { BookReel } from "@/components/reel/BookReel";
import { pageTitle } from "@/lib/brand";
import { getAppSession } from "@/lib/session";
import { buildStarterReel, type ReelCard } from "@/lib/reel";

// Same reading face the book summary uses, so a gist reads identically
// whether it's reached from the reel or from today's pick.
const readingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-reading-serif",
  display: "swap",
});

export const metadata = {
  title: pageTitle("Gists"),
  description:
    "A personalized stream of book gists — read, keep the lines that stay with you, swipe past the rest.",
};

/**
 * The opening gists ship in the HTML: the starter rotation needs no ranker, so
 * a signed-in reader starts reading on first paint instead of waiting for the
 * client to resolve its session and then fetch. The personalized run is
 * fetched behind them.
 */
export default async function HomePage() {
  const session = await getAppSession();
  const userId = session?.user?.id;

  let initialCards: ReelCard[] | undefined;
  if (userId) {
    // A slow or failed starter just means the client fetches it instead.
    initialCards = await buildStarterReel(userId).catch((err: unknown) => {
      console.warn("[gists] starter prerender failed:", err);
      return undefined;
    });
  }

  return (
    <div className={readingSerif.variable}>
      <BookReel initialCards={initialCards} signedIn={Boolean(userId)} />
    </div>
  );
}
