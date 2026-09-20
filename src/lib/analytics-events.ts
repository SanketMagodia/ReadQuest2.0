import { gaEvent } from "@/lib/analytics";

/** GA4 recommended + app-specific events for reports (Realtime, engagement, leads). */

export function trackLogin(method: "credentials" | "google") {
  gaEvent("login", { method });
}

export function trackSignUp(method: "credentials" | "google" = "credentials") {
  gaEvent("sign_up", { method });
}

export function trackSearch(params: {
  searchTerm?: string;
  category?: string;
  location: "explore" | "friends" | "memories";
}) {
  const term = (params.searchTerm ?? params.category ?? "").trim();
  if (!term) return;
  gaEvent("search", {
    search_term: term.slice(0, 100),
    content_type: params.location,
  });
}

/** "Recommend me" — a described vibe answered with AI book picks. */
export function trackVibeRecommend(vibe: string, resultCount: number) {
  gaEvent("ai_recommend", {
    search_term: vibe.slice(0, 100),
    result_count: resultCount,
  });
}

export function trackSelectBook(bookId: string, title: string, source?: string) {
  gaEvent("select_item", {
    item_list_id: source ?? "books",
    item_list_name: "Books",
    items: [{ item_id: bookId, item_name: title.slice(0, 100) }],
  });
}

/** A private line or note saved to the reader's own memories. */
export function trackMemorySaved(
  bookId: string | null,
  source: "gist" | "profile" | "summary"
) {
  gaEvent("memory_saved", {
    book_id: bookId ?? "none",
    content_type: source,
  });
}

/** What a reader did with a card in the home reel. */
export function trackReelAction(
  bookId: string,
  action: "skipped" | "read" | "saved"
) {
  gaEvent("reel_action", { book_id: bookId, action });
}

export function trackFollowBook(bookId: string, following: boolean) {
  gaEvent(following ? "follow_book" : "unfollow_book", { book_id: bookId });
}

export function trackReadlistUpdate(
  bookId: string,
  status: "want" | "read" | "remove"
) {
  gaEvent("readlist_update", { book_id: bookId, shelf_status: status });
}

export function trackViewSummary(bookId: string, slug: string) {
  gaEvent("view_summary", { book_id: bookId, book_slug: slug });
}

export function trackGenerateSummary(bookId: string, scope: "shared" | "personal") {
  gaEvent("generate_summary", { book_id: bookId, summary_scope: scope });
}

export function trackFriendAction(
  action: "request" | "accept" | "decline" | "cancel" | "remove"
) {
  gaEvent("friend_action", { action });
}

export function trackPwaInstall(outcome: "accepted" | "dismissed" | "prompt") {
  gaEvent("pwa_install", { outcome });
}

export function trackShare(contentType: string, itemId: string) {
  gaEvent("share", {
    content_type: contentType,
    item_id: itemId,
  });
}
