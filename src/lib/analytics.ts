/** Public GA4 ID (safe to expose — it appears in page source anyway). */
export const PRODUCTION_GA_MEASUREMENT_ID = "G-KPSM10HVTC";

/** GA4 measurement ID — env first, then production fallback for thegist.club deploys. */
export function getGaMeasurementId(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
    process.env.GA_MEASUREMENT_ID?.trim() ||
    "";
  if (fromEnv.startsWith("G-")) return fromEnv;
  if (process.env.NODE_ENV === "production") return PRODUCTION_GA_MEASUREMENT_ID;
  return "";
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

type GaParamValue = string | number | boolean | undefined;

export function gaEvent(
  action: string,
  params?: Record<string, GaParamValue | Record<string, GaParamValue>[]>
) {
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", action, params);
}
