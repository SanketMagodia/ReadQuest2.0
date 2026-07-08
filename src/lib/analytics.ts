export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

/** Load GA in production by default; set NEXT_PUBLIC_GA_DEBUG=true to test locally. */
export function isGoogleAnalyticsEnabled() {
  if (!GA_MEASUREMENT_ID.startsWith("G-")) return false;
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
  if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("config", GA_MEASUREMENT_ID, {
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
