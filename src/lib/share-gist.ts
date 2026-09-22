import { trackShare } from "@/lib/analytics-events";
import { isAllowedCoverUrl } from "@/lib/cover-url";

export type GistShareResult = "shared" | "saved" | "cancelled";

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

/** Two short sentences from the catalog blurb, or the opening of the gist. */
export function littleSynopsis(description: string, summary: string, hook: string) {
  const fromSummary = summary
    .replace(/^>\s?/gm, "")
    .replace(/[#*_`]/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  const raw = (description || fromSummary || hook || "")
    .replace(/\s+/g, " ")
    .replace(/^["“]+|["”]+$/g, "")
    .trim();
  if (!raw) return "";

  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > 240 && out) break;
    out = next;
    if (out.length >= 160) break;
  }
  if (!out) out = raw.slice(0, 220).trim();
  if (out.length < raw.length && !/[.!?…]$/.test(out)) {
    out = out.replace(/\s+\S*$/, "").trimEnd() + "…";
  }
  return out;
}

function shareCaption(title: string, synopsis: string, bookUrl: string) {
  return [title, synopsis, bookUrl].filter(Boolean).join("\n\n");
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Title and synopsis sit above the gist page so they travel with the picture. */
async function withTitleAndSynopsis(blob: Blob, title: string, synopsis: string) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  const padX = Math.round(bitmap.width * 0.06);
  const titleSize = Math.max(28, Math.round(bitmap.width * 0.046));
  const bodySize = Math.max(18, Math.round(bitmap.width * 0.03));
  const maxText = bitmap.width - padX * 2;
  const titleFont = `700 ${titleSize}px ui-sans-serif, system-ui, sans-serif`;
  const bodyFont = `400 ${bodySize}px ui-sans-serif, system-ui, sans-serif`;

  ctx.font = titleFont;
  const titleLines = wrapLines(ctx, title, maxText).slice(0, 3);
  ctx.font = bodyFont;
  const synopsisLines = synopsis ? wrapLines(ctx, synopsis, maxText) : [];
  const shownSynopsis = synopsisLines.slice(0, 4);
  if (synopsisLines.length > shownSynopsis.length && shownSynopsis.length) {
    const last = shownSynopsis.length - 1;
    shownSynopsis[last] = shownSynopsis[last].replace(/\s+\S*$/, "").trimEnd() + "…";
  }

  const titleLH = Math.round(titleSize * 1.22);
  const synLH = Math.round(bodySize * 1.45);
  const padY = Math.round(bitmap.width * 0.05);
  const gap = shownSynopsis.length ? Math.round(bodySize * 0.85) : 0;
  const captionH =
    padY + titleLines.length * titleLH + gap + shownSynopsis.length * synLH + padY;

  canvas.width = bitmap.width;
  canvas.height = bitmap.height + captionH;

  const bg = getComputedStyle(document.body).backgroundColor || "#111";
  const fg = getComputedStyle(document.body).color || "#fff";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";
  ctx.fillStyle = fg;
  ctx.font = titleFont;
  let y = padY;
  for (const line of titleLines) {
    ctx.fillText(line, padX, y);
    y += titleLH;
  }
  y += gap;
  ctx.globalAlpha = 0.78;
  ctx.font = bodyFont;
  for (const line of shownSynopsis) {
    ctx.fillText(line, padX, y);
    y += synLH;
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(bitmap, 0, captionH);
  bitmap.close();

  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  return out ?? blob;
}

function downloadBlob(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
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

  clone.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:") || src.startsWith("/api/cover")) return;
    try {
      const absolute = new URL(src, window.location.href).href;
      if (isAllowedCoverUrl(absolute)) img.src = coverProxy(src);
    } catch {
      img.removeAttribute("src");
    }
  });

  host.appendChild(clone);
  document.body.appendChild(host);
  warmFonts(clone);

  const options = {
    pixelRatio: 2,
    cacheBust: false,
    includeQueryParams: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    filter: (node: HTMLElement) => !node.hasAttribute?.("data-no-shot"),
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
  synopsis: string;
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
  synopsis: string;
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

  const blob = await withTitleAndSynopsis(shot, input.title, input.synopsis);
  return {
    file: new File([blob], fileName(input.title), { type: "image/png" }),
    title: input.title,
    synopsis: input.synopsis,
    caption: shareCaption(input.title, input.synopsis, input.bookUrl),
    bookUrl: input.bookUrl,
    bookId: input.bookId,
  };
}

function sharePayload(prepared: PreparedGistShare): ShareData | null {
  const withFile: ShareData = {
    files: [prepared.file],
    title: prepared.title,
    text: prepared.caption,
  };
  const withFileAndUrl: ShareData = { ...withFile, url: prepared.bookUrl };
  const textOnly: ShareData = {
    title: prepared.title,
    text: prepared.caption,
    url: prepared.bookUrl,
  };
  if (typeof navigator.share !== "function") return null;
  if (typeof navigator.canShare !== "function") return withFileAndUrl;
  if (navigator.canShare(withFileAndUrl)) return withFileAndUrl;
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
    return Promise.resolve("saved");
  }

  return navigator.share(payload).then(
    () => {
      trackShare("gist", prepared.bookId);
      return "shared" as const;
    },
    (err: unknown) => {
      if (isAbort(err)) return "cancelled" as const;
      saveLocally(prepared);
      return "saved" as const;
    }
  );
}
