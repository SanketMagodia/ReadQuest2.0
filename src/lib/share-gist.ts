import { trackShare } from "@/lib/analytics-events";
import { BRAND_NAME } from "@/lib/brand";
import { isAllowedCoverUrl } from "@/lib/cover-url";

export type GistShareResult = "shared" | "saved" | "cancelled" | "unsupported";

/** 1×1 transparent PNG, so a cover we can't read never rejects the snapshot. */
const BLANK_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

/**
 * Whether this browser can open a share sheet. `navigator.share` only exists
 * in a secure context, so a phone on `http://<lan-ip>` has no sheet at all —
 * that needs HTTPS (or localhost).
 */
export function canOpenShareSheet() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function fileName(title: string) {
  const base =
    title
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "gist";
  return `${base}.png`;
}

function isAbort(err: unknown) {
  return err instanceof DOMException && err.name === "AbortError";
}

function coverProxy(src: string) {
  const absolute = new URL(src, window.location.href);
  if (absolute.protocol === "http:") absolute.protocol = "https:";
  return `/api/cover?url=${encodeURIComponent(absolute.href)}`;
}

/**
 * The whole message, in this order. The link is a line of the text because
 * phones drop the share sheet's separate `url` field once an image is attached.
 */
function shareCaption(title: string, author: string, bookUrl: string) {
  const who = author.trim();
  const invite = who
    ? `Read ${who}'s gist on ${BRAND_NAME}`
    : `Read the gist on ${BRAND_NAME}`;
  return [title, invite, bookUrl].filter(Boolean).join("\n");
}

function downloadBlob(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

async function toDataUrl(src: string) {
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error(`cover ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("cover unreadable"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Turn every jacket into a data URL before the canvas step. html-to-image
 * rejects the whole snapshot when one image fails, and a cover host can always
 * have a bad minute, so a missing jacket becomes a blank pixel instead.
 */
async function inlineImages(clone: HTMLElement) {
  const images = [...clone.querySelectorAll("img")];
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const absolute = new URL(src, window.location.href).href;
        const source = isAllowedCoverUrl(absolute) ? coverProxy(src) : absolute;
        img.src = await toDataUrl(source);
      } catch {
        img.src = BLANK_PIXEL;
      }
      img.removeAttribute("srcset");
      img.removeAttribute("loading");
    })
  );
}

let cachedFontCSS: string | null = null;
let fontEmbedPromise: Promise<string> | null = null;

/** Start the slow font fetch before the tap, so the snapshot itself stays short. */
function warmFonts(node: HTMLElement) {
  if (cachedFontCSS !== null || fontEmbedPromise) return;
  fontEmbedPromise = import("html-to-image")
    .then(({ getFontEmbedCSS }) => getFontEmbedCSS(node, { cacheBust: false }))
    .then((css) => {
      cachedFontCSS = css;
      return css;
    })
    .catch(() => {
      cachedFontCSS = "";
      return "";
    });
}

/**
 * Paint a copy of the gist card, forced onto page one, and turn it into a PNG.
 * The live card stays where the reader left it.
 */
async function snapshotFirstPage(
  section: HTMLElement,
  firstPageHtml: string,
  totalPages: number
) {
  const { toBlob } = await import("html-to-image");
  const rect = section.getBoundingClientRect();
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${rect.width}px;height:${rect.height}px;overflow:hidden;pointer-events:none;`;

  const clone = section.cloneNode(true) as HTMLElement;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.querySelectorAll(".rq-page-turn").forEach((el) => {
    el.classList.remove("rq-page-turn");
  });

  const body = clone.querySelector("[data-gist-body]");
  if (body && firstPageHtml) body.innerHTML = firstPageHtml;

  const pages = Math.max(totalPages, 1);
  clone.querySelectorAll("[data-page-label]").forEach((el) => {
    const wide = el.getAttribute("data-page-label") === "wide";
    el.textContent = wide ? `1 / ${pages}` : `1/${pages}`;
  });
  const bar = clone.querySelector("[data-gist-progress]");
  if (bar instanceof HTMLElement) bar.style.width = `${(1 / pages) * 100}%`;

  host.appendChild(clone);
  document.body.appendChild(host);
  warmFonts(clone);
  await inlineImages(clone);

  const options = {
    pixelRatio: 2,
    cacheBust: false,
    includeQueryParams: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    filter: (node: HTMLElement) => !node.hasAttribute?.("data-no-shot"),
    imagePlaceholder: BLANK_PIXEL,
    onImageErrorHandler: () => {},
    ...(cachedFontCSS !== null
      ? { fontEmbedCSS: cachedFontCSS }
      : { skipFonts: true }),
  };

  try {
    await Promise.all(
      [...clone.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined))
    );
    try {
      return await toBlob(clone, options);
    } catch {
      return await toBlob(clone, { ...options, skipFonts: true, fontEmbedCSS: undefined });
    }
  } finally {
    host.remove();
  }
}

export type PreparedGistShare = {
  file: File;
  title: string;
  caption: string;
  bookUrl: string;
  bookId: string;
};

/**
 * Build the picture and caption. This is slow, so it must not be the call
 * that opens the phone share sheet — that gesture expires while the snapshot
 * is still painting.
 */
export async function prepareGistShare(input: {
  section: HTMLElement;
  firstPageHtml: string;
  title: string;
  author: string;
  bookUrl: string;
  bookId: string;
  totalPages: number;
}): Promise<PreparedGistShare> {
  const shot = await snapshotFirstPage(
    input.section,
    input.firstPageHtml,
    input.totalPages
  );
  if (!shot) throw new Error("empty snapshot");

  return {
    file: new File([shot], fileName(input.title), { type: "image/png" }),
    title: input.title,
    caption: shareCaption(input.title, input.author, input.bookUrl),
    bookUrl: input.bookUrl,
    bookId: input.bookId,
  };
}

function sharePayload(prepared: PreparedGistShare): ShareData | null {
  // The link is already the last line of `text`. A separate `url` is what
  // phones throw away alongside an image, which is how the link went missing.
  const withFile: ShareData = {
    files: [prepared.file],
    title: prepared.title,
    text: prepared.caption,
  };
  const textOnly: ShareData = {
    title: prepared.title,
    text: prepared.caption,
  };
  if (typeof navigator.share !== "function") return null;
  if (typeof navigator.canShare !== "function") return withFile;
  if (navigator.canShare(withFile)) return withFile;
  if (navigator.canShare(textOnly)) return textOnly;
  // Some phones report canShare false until share() itself is called.
  return withFile;
}

function saveLocally(prepared: PreparedGistShare) {
  downloadBlob(prepared.file);
  void navigator.clipboard?.writeText(prepared.caption).catch(() => {});
  trackShare("gist", prepared.bookId);
}

/**
 * Open the system share sheet. Call this directly from a tap — phones ignore
 * `navigator.share` after the snapshot's awaits have used up the first one.
 */
export function invokeGistShare(prepared: PreparedGistShare): Promise<GistShareResult> {
  const payload = sharePayload(prepared);
  if (!payload) {
    saveLocally(prepared);
    return Promise.resolve(canOpenShareSheet() ? "saved" : "unsupported");
  }

  // WhatsApp and friends sometimes keep the picture and drop the caption, so
  // leave it on the clipboard to paste. Must happen inside the same tap.
  if (payload.files) {
    void navigator.clipboard?.writeText(prepared.caption).catch(() => {});
  }

  return navigator.share(payload).then(
    () => {
      trackShare("gist", prepared.bookId);
      return "shared" as const;
    },
    (err: unknown) => {
      if (isAbort(err)) return "cancelled" as const;
      // A target that refuses the file still takes the caption and the link.
      if (payload.files) {
        return navigator
          .share({ title: prepared.title, text: prepared.caption })
          .then(
            () => {
              trackShare("gist", prepared.bookId);
              return "shared" as const;
            },
            (second: unknown) => {
              if (isAbort(second)) return "cancelled" as const;
              saveLocally(prepared);
              return "saved" as const;
            }
          );
      }
      saveLocally(prepared);
      return "saved" as const;
    }
  );
}
