import { pageTitle, BRAND_NAME } from "@/lib/brand";
import { PrivacyContent } from "@/components/info/PrivacyContent";

export const metadata = {
  title: pageTitle("Privacy"),
  description: `How ${BRAND_NAME} handles your data and privacy.`,
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
