import { getGaMeasurementId, isGoogleAnalyticsEnabled } from "@/lib/analytics";

/**
 * Google tag (gtag.js) — pasted immediately after <head> on every page.
 * @see https://support.google.com/analytics/answer/9304153
 */
export function GoogleAnalyticsScripts() {
  if (!isGoogleAnalyticsEnabled()) return null;

  const id = getGaMeasurementId();
  if (!id.startsWith("G-")) return null;

  // Exact structure from Google Analytics install instructions (one tag per page).
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', '${id}');`,
        }}
      />
    </>
  );
}
