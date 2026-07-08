"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getGaMeasurementId, isGoogleAnalyticsEnabled } from "@/lib/analytics";

/**
 * Sets GA4 user_id + user properties for retention / User reports.
 * Uses internal Mongo id — not email or username (PII-safe).
 */
export function AnalyticsIdentity() {
  const { data: session, status } = useSession();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isGoogleAnalyticsEnabled() || typeof window.gtag !== "function") return;

    const id = getGaMeasurementId();
    if (!id) return;

    const userId = session?.user?.id;
    const loggedIn = status === "authenticated" && Boolean(userId);

    if (loggedIn && userId) {
      window.gtag("config", id, { user_id: userId });
      window.gtag("set", "user_properties", {
        logged_in: "yes",
        account_role: session?.user?.role ?? "user",
      });
      lastUserId.current = userId;
    } else if (lastUserId.current) {
      window.gtag("config", id, { user_id: undefined });
      window.gtag("set", "user_properties", {
        logged_in: "no",
        account_role: "guest",
      });
      lastUserId.current = null;
    } else {
      window.gtag("set", "user_properties", {
        logged_in: "no",
        account_role: "guest",
      });
    }
  }, [session, status]);

  return null;
}
