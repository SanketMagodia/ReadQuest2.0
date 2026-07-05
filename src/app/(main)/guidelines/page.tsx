import { pageTitle, BRAND_NAME } from "@/lib/brand";
import { GuidelinesContent } from "@/components/info/GuidelinesContent";

export const metadata = {
  title: pageTitle("Community Guidelines"),
  description: `Community standards for ${BRAND_NAME} — be kind, be honest, keep it about the books.`,
};

export default function GuidelinesPage() {
  return <GuidelinesContent />;
}
