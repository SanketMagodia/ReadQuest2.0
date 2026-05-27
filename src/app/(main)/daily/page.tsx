import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { DailyReader } from "./DailyReader";

const readingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-reading-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily quest",
  description:
    "Read today's pick in a flippable, paged book format and grow your reading streak.",
  robots: { index: false, follow: true },
};

export default function DailyPage() {
  return (
    <div className={readingSerif.variable}>
      <DailyReader />
    </div>
  );
}

export const revalidate = 0;
