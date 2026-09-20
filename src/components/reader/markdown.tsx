import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small markdown subset — headings, paragraphs, blockquotes,
 * and rules — matching what the summary prompt is allowed to emit. Shared by
 * the book summary reader and the home reel's gist sheet so both read
 * identically.
 */
export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "rule" };

export function parseMarkdown(input: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = input.split(/\r?\n/);
  let buf: string[] = [];
  let bq: string[] = [];

  const flushParagraph = () => {
    const t = buf.join(" ").trim();
    buf = [];
    if (t) blocks.push({ type: "paragraph", text: t });
  };
  const flushBlockquote = () => {
    const t = bq.join(" ").trim();
    bq = [];
    if (t) blocks.push({ type: "blockquote", text: t });
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBlockquote();
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();
      flushBlockquote();
      blocks.push({ type: "rule" });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushParagraph();
      flushBlockquote();
      blocks.push({
        type: "heading",
        level: h[1].length as 1 | 2 | 3,
        text: h[2],
      });
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushParagraph();
      bq.push(q[1]);
      continue;
    }
    flushBlockquote();
    buf.push(line);
  }
  flushParagraph();
  flushBlockquote();
  return blocks;
}

function wordCount(s: string) {
  return (s.match(/\S+/g) || []).length;
}

/**
 * Splits long paragraphs/blockquotes into ~28-word sentence-aligned chunks so
 * the measurement-based bin packer always has fine-grained atoms to pack.
 * Short blocks are untouched — typical reads will look unchanged.
 */
export function prepareBlocksForPagination(blocks: MdBlock[]): MdBlock[] {
  const MAX_BLOCK_WORDS = 45;
  const TARGET_CHUNK_WORDS = 28;
  const out: MdBlock[] = [];

  for (const b of blocks) {
    const canSplit = b.type === "paragraph" || b.type === "blockquote";
    if (!canSplit) {
      out.push(b);
      continue;
    }
    if (wordCount(b.text) <= MAX_BLOCK_WORDS) {
      out.push(b);
      continue;
    }
    const sentences = splitSentences(b.text);
    let buf: string[] = [];
    let bufW = 0;
    const flush = () => {
      if (!buf.length) return;
      out.push({ type: b.type, text: buf.join(" ") });
      buf = [];
      bufW = 0;
    };
    for (const s of sentences) {
      const sw = wordCount(s);
      if (bufW > 0 && bufW + sw > TARGET_CHUNK_WORDS) flush();
      buf.push(s);
      bufW += sw;
    }
    flush();
  }
  return out;
}

function splitSentences(text: string): string[] {
  // Split on real sentence ends, not honorifics ("Mr. Reed") or initials
  // ("J. K."). Those used to become their own paragraph and look like a
  // skipped line in the gist.
  const parts = text
    .split(
      /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|Ft|vs|etc|Inc|Ltd|Gen|Col|Capt|Rev|Hon|Sgt|Lt|Gov|Ave|Blvd|Rd|Vol|Ch)|[A-Z])\.\s+(?=[A-Z“"])|(?<=[!?])\s+(?=[A-Z“"])/g
    )
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 60) {
      chunks.push(words.slice(i, i + 60).join(" "));
    }
    return chunks;
  }
  return parts;
}

/**
 * Bin-packs already-rendered blocks into pages using their measured heights.
 *
 * `container` must be CSS-identical to a real page and hold exactly one child
 * per block, laid out naturally so the overflow is clipped rather than
 * reflowed — that's what makes the measurement match what a page will show.
 * Returns null when the DOM isn't settled enough to trust.
 */
export function packBlocksIntoPages(
  container: HTMLElement,
  blocks: MdBlock[]
): MdBlock[][] | null {
  const pageHeight = container.clientHeight;
  if (pageHeight <= 0) return null;

  const children = Array.from(container.children) as HTMLElement[];
  if (children.length !== blocks.length) return null;

  // Rects rather than offsetTop, so the container can be positioned or static
  // without changing the arithmetic.
  const base = container.getBoundingClientRect().top;
  const pages: MdBlock[][] = [[]];
  let pageStart = 0;

  for (let i = 0; i < children.length; i++) {
    const top = children[i].getBoundingClientRect().top - base;
    const bottom = top + children[i].offsetHeight;
    if (bottom > pageStart + pageHeight && pages[pages.length - 1].length > 0) {
      pages.push([]);
      pageStart = top;
    }
    pages[pages.length - 1].push(blocks[i]);
  }
  return pages;
}

/** True when a re-measure produced the same shape, so state can stay put. */
export function samePagination(
  a: MdBlock[][] | null,
  b: MdBlock[][]
): boolean {
  return (
    !!a && a.length === b.length && a.every((p, i) => p.length === b[i].length)
  );
}

export function renderBlock(b: MdBlock, key: string): ReactNode {
  if (b.type === "rule") {
    return (
      <div
        key={key}
        className="ornament my-3"
        aria-hidden
        style={{ color: "currentColor", opacity: 0.55 }}
      >
        <span>·</span>
        <span>·</span>
        <span>·</span>
      </div>
    );
  }
  if (b.type === "heading") {
    if (b.level === 1 || b.level === 2) {
      return <h2 key={key}>{renderInline(b.text, key)}</h2>;
    }
    return (
      <h3
        key={key}
        className="mb-1 mt-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        {renderInline(b.text, key)}
      </h3>
    );
  }
  if (b.type === "blockquote") {
    return (
      <blockquote
        key={key}
        className="my-2 italic"
        style={{
          borderLeft: "3px solid",
          paddingLeft: 12,
          opacity: 0.85,
        }}
      >
        {renderInline(b.text, key)}
      </blockquote>
    );
  }
  return <p key={key}>{renderInline(b.text, key)}</p>;
}

export function renderInline(text: string, scope: string): ReactNode[] {
  const out: ReactNode[] = [];
  let remaining = text.replace(
    /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt)\.\s+/g,
    "$1.\u00A0"
  );
  let i = 0;
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/;
  while (remaining.length) {
    const m = remaining.match(re);
    if (!m || m.index === undefined) {
      out.push(<Fragment key={`${scope}-t-${i++}`}>{remaining}</Fragment>);
      break;
    }
    if (m.index > 0)
      out.push(
        <Fragment key={`${scope}-t-${i++}`}>
          {remaining.slice(0, m.index)}
        </Fragment>
      );
    if (m[1]) out.push(<strong key={`${scope}-b-${i++}`}>{m[1]}</strong>);
    else out.push(<em key={`${scope}-i-${i++}`}>{m[2] || m[3]}</em>);
    remaining = remaining.slice(m.index + m[0].length);
  }
  return out;
}
