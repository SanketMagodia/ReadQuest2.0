/** GA4 measurement ID — server reads either var; client bundle only inlines NEXT_PUBLIC_*. */
export function getGaMeasurementId(): string {
  return (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
    process.env.GA_MEASUREMENT_ID?.trim() ||
    ""
  );
}

/** Load GA in production by default; set NEXT_PUBLIC_GA_DEBUG=true to test locally. */
export function isGoogleAnalyticsEnabled(): boolean {
  const id = getGaMeasurementId();
  if (!id.startsWith("G-")) return false;
  if (process.env.NODE_ENV === "production") return true;
  return process.env.NEXT_PUBLIC_GA_DEBUG === "true";
}

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js" | "set",
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

export function pageview(url: string) {
  const id = getGaMeasurementId();
  if (!isGoogleAnalyticsEnabled() || !id || typeof window.gtag !== "function") return;
  window.gtag("config", id, {
    page_path: url,
  });
}

export function gaEvent(
  action: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", action, params);
}
