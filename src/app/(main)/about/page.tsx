import { pageTitle, BRAND_NAME } from "@/lib/brand";
import { AboutContent } from "@/components/info/AboutContent";

export const metadata = {
  title: pageTitle("About"),
  description: `Learn about ${BRAND_NAME} — our vision for a reader-first book community.`,
};

export default function AboutPage() {
  return <AboutContent />;
}
