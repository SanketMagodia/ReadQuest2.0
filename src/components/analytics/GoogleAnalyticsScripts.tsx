import { getGaMeasurementId, isGoogleAnalyticsEnabled } from "@/lib/analytics";

/**
 * Server-rendered GA4 tags in <head> — matches Google's install snippet so
 * Tag Assistant / "Test your website" can detect gtag in page source.
 */
export function GoogleAnalyticsScripts() {
  if (!isGoogleAnalyticsEnabled()) return null;

  const id = getGaMeasurementId();
  if (!id.startsWith("G-")) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${id}');
          `,
        }}
      />
    </>
  );
}
