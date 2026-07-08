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
  location: "explore" | "friends" | "compose";
}) {
  const term = (params.searchTerm ?? params.category ?? "").trim();
  if (!term) return;
  gaEvent("search", {
    search_term: term.slice(0, 100),
    content_type: params.location,
  });
}

export function trackSelectBook(bookId: string, title: string, source?: string) {
  gaEvent("select_item", {
    item_list_id: source ?? "books",
    item_list_name: "Books",
    items: [{ item_id: bookId, item_name: title.slice(0, 100) }],
  });
}

export function trackPostCreated(bookId: string, hasImage: boolean) {
  gaEvent("create_post", {
    book_id: bookId,
    has_image: hasImage ? "yes" : "no",
  });
}

export function trackComment(postId: string, isReply: boolean) {
  gaEvent("comment", {
    post_id: postId,
    is_reply: isReply ? "yes" : "no",
  });
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

export function trackReaction(
  target: "post" | "comment",
  reaction: "like" | "dislike" | "remove"
) {
  gaEvent("reaction", { target_type: target, reaction_type: reaction });
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
