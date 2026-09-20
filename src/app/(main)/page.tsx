import { Source_Serif_4 } from "next/font/google";
import { BookReel } from "@/components/reel/BookReel";
import { pageTitle } from "@/lib/brand";

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

export default function HomePage() {
  return (
    <div className={readingSerif.variable}>
      <BookReel />
    </div>
  );
}
