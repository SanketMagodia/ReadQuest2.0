"""
Fill missing book gists. Safe to stop and rerun — it only writes books that
still have no summary.

Every day:  python scripts/generate_book_summaries.py

It reads MONGODB_URI, OPENROUTER_API_KEY, and OPENROUTER_MODEL from
.env.local (then .env), the same files the Next app uses. Default run is
60 minutes so a daily hour-long pass ends itself; Ctrl-C finishes the
current book and then exits.

Requires:  pip install pymongo
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from pymongo import MongoClient
    from pymongo.collection import Collection
    from pymongo.database import Database
    from pymongo.errors import ConfigurationError
except ImportError:
    sys.stderr.write("pymongo is missing. Install it with:\n  pip install pymongo\n")
    raise SystemExit(1)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
DEFAULT_BRIEF = (
    "Write a tight, distilled retelling of the book in the book's own voice "
    "— like a miniature edition of the book itself."
)
TRANSIENT = re.compile(
    r"overload|temporarily|timed? ?out|capacity|try again|rate limit",
    re.I,
)

# The free Nemotron tier thinks before it writes, and those tokens come out of
# the same max_tokens pot as the gist. 2400 is enough for the prose and not
# for the thinking — that's why a 2-minute call still came back truncated.
ANSWER_TOKENS = 2400
THINKING_TOKENS = 6000
MAX_TOKENS_CEILING = 16000
# Overload is the normal state of the free pool, not a rare blip.
MAX_ATTEMPTS = 8
RETRY_BACKOFF_S = 15.0
SLEEP_BETWEEN_S = 1.5
REQUEST_TIMEOUT_S = 240


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        os.environ[key] = value


def load_env() -> None:
    root = project_root()
    load_env_file(root / ".env.local")
    load_env_file(root / ".env")
    load_env_file(Path.cwd() / ".env.local")
    load_env_file(Path.cwd() / ".env")


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate AI summaries for books that do not have one yet."
    )
    p.add_argument(
        "--minutes",
        type=float,
        default=60,
        help="Stop after this many minutes (default 60). 0 = no time cap.",
    )
    p.add_argument(
        "--sleep-ms",
        type=int,
        default=int(os.environ.get("SUMMARY_SLEEP_MS", str(int(SLEEP_BETWEEN_S * 1000)))),
        help="Pause between successful LLM calls (default 1500, or SUMMARY_SLEEP_MS).",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Stop after this many successful writes this run (0 = no cap).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the remaining queue; no LLM calls, no writes.",
    )
    return p.parse_args(argv)


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def clean_summary(raw: str) -> str:
    s = raw.strip()
    s = re.sub(r"^```(?:markdown|md)?\s*\n", "", s, flags=re.I)
    s = re.sub(r"\n```\s*$", "", s)
    s = re.sub(r"^(summary|overview)\s*[:\-—]\s*", "", s, flags=re.I)
    return s.strip()


def is_fiction(categories: str) -> bool:
    return bool(
        re.search(
            r"(fiction|novel|stories|fantasy|sci.?fi|mystery|romance|thriller|literature|poetry)",
            categories,
            re.I,
        )
    )


def build_prompts(book: dict) -> tuple[str, str]:
    desc = (book.get("description") or "")[:1800]
    fiction = is_fiction(book.get("categories") or "")
    system = "\n".join(
        [
            "You are condensing a book into a MINI-BOOK for a reading community called The Gist Club (TGC).",
            "The output should READ LIKE THE BOOK, not like a summary.",
            "",
            "VOICE",
            "- Mirror the book's prose style, tense, and tone. If the book is lyrical, be lyrical. If it's hard-boiled, be terse. If it's academic, be measured.",
            "- Use the book's vocabulary and sentence rhythm. Quote it sparingly when a line really matters.",
            (
                "- Tell the story as a story — characters acting, scenes turning, time moving forward."
                if fiction
                else "- Carry the argument as the author carries it — ideas unfolding, examples landing, conclusions earned."
            ),
            "- Spoilers are expected — the reader opted in to the full experience.",
            "",
            "FORBIDDEN",
            "- Do NOT use meta-summary section labels like 'Snapshot', 'Plot', 'Characters', 'Themes', 'Style', 'Setup', 'Overview', 'Conclusion', 'Analysis', 'Takeaways', 'Synopsis'.",
            "- Do NOT write analytical commentary about the book ('this novel explores…', 'the author argues…').",
            "- Do NOT write a preamble. Start in-scene or in-idea, like the book itself opens.",
            "- Do NOT echo the book's title or author as a heading.",
            "- Do NOT wrap the answer in code fences.",
            "",
            "FORMAT",
            "- Markdown. ~900–1400 words.",
            "- 4–7 chapter-like sections. Each is given a SHORT, ATMOSPHERIC heading drawn from the book's content (e.g. `## The Island`, `## What She Knew`, `## Free Will Is a Useful Fiction`). Never use generic labels.",
            "- Inside each section: flowing prose, short paragraphs. The pace should feel like reading the book at 5× speed — beats and turning points kept, connective tissue cut.",
            "- A `> short line` blockquote is OK once or twice when a single phrase carries the chapter's weight. Skip it if forced.",
            "- A `---` line on its own creates an ornamental pause. Use at most one between major movements.",
            "- `**bold**` only for a name first introduced or a single phrase that hits — sparingly.",
            "",
            "GOAL",
            "The reader closes this and feels like they've actually read the book — emotionally, intellectually — only faster.",
        ]
    )
    user_lines = [
        "Book metadata (your context — never echo as a heading):",
        f"Title: {book.get('title') or ''}",
    ]
    if book.get("authors"):
        user_lines.append(f"Author: {book['authors']}")
    if book.get("publishedYear"):
        user_lines.append(f"Published: {book['publishedYear']}")
    if book.get("categories"):
        user_lines.append(f"Categories: {book['categories']}")
    if desc:
        user_lines.append(
            f"Publisher blurb (reference only — expand far beyond this): {desc}"
        )
    user_lines.extend(
        [
            "",
            f"Voice direction: {DEFAULT_BRIEF}",
            "",
            "Write the mini-book now. Open on the first chapter heading.",
        ]
    )
    return system, "\n".join(user_lines)


class LlmError(Exception):
    def __init__(self, message: str, retryable: bool = False, kind: str = ""):
        super().__init__(message)
        self.retryable = retryable
        self.kind = kind


def llm_chat(
    api_key: str,
    model: str,
    system: str,
    user: str,
    referer: str,
    max_tokens: int,
) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.85,
        "max_tokens": max_tokens,
        "reasoning_effort": "none",
        "include_reasoning": False,
    }
    req = urllib.request.Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": referer,
            "X-Title": "The Gist Club",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as res:
            body = res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")[:400]
        retryable = err.code == 429 or err.code >= 500
        raise LlmError(f"OpenRouter request failed ({err.code}): {detail}", retryable)
    except urllib.error.URLError as err:
        raise LlmError(f"OpenRouter network error: {err.reason}", True)

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise LlmError(f"OpenRouter returned a non-JSON body: {body.strip()[:200]}", True)

    if data.get("error", {}).get("message"):
        message = data["error"]["message"]
        raise LlmError(f"OpenRouter error: {message}", bool(TRANSIENT.search(message)))

    choice = (data.get("choices") or [None])[0] or {}
    finish = choice.get("finish_reason") or choice.get("native_finish_reason")
    content = ((choice.get("message") or {}).get("content") or "").strip()
    if finish == "length":
        cleaned = clean_summary(content)
        # A cut mid-thought is unusable. A cut after several finished chapters
        # is a gist we can keep rather than paying for another 2-minute call.
        if word_count(cleaned) >= 700 and "##" in cleaned:
            return cleaned
        raise LlmError(
            f"OpenRouter response truncated at {max_tokens} tokens",
            True,
            kind="truncated",
        )
    if not content:
        raise LlmError(
            f"OpenRouter returned empty completion (finish_reason {finish or 'unknown'})",
            True,
        )
    return content


def generate_with_retries(api_key: str, model: str, book: dict, referer: str) -> dict:
    system, user = build_prompts(book)
    last: Exception | None = None
    budget = ANSWER_TOKENS + THINKING_TOKENS
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw = llm_chat(api_key, model, system, user, referer, budget)
            content = clean_summary(raw)
            if not content:
                raise LlmError("AI returned an empty summary", False)
            return {"content": content, "model": model, "wordCount": word_count(content)}
        except LlmError as err:
            last = err
            if not err.retryable or attempt == MAX_ATTEMPTS:
                raise
            if err.kind == "truncated":
                budget = min(MAX_TOKENS_CEILING, int(budget * 1.5))
                wait = 3.0
                print(f"    retry {attempt}/{MAX_ATTEMPTS} with max_tokens={budget} — {err}")
            else:
                wait = min(90.0, RETRY_BACKOFF_S * (2 ** (attempt - 1)))
                print(f"    retry {attempt}/{MAX_ATTEMPTS} in {wait:.0f}s — {err}")
            time.sleep(wait)
    raise last or LlmError("summary generation exhausted its attempts")


def remaining_pipeline(limit: int) -> list[dict]:
    pipeline: list[dict] = [
        {"$match": {"description": {"$type": "string", "$ne": ""}}},
        {
            "$lookup": {
                "from": "booksummaries",
                "localField": "_id",
                "foreignField": "book",
                "as": "summaries",
            }
        },
        {"$match": {"summaries": {"$size": 0}}},
        {"$sort": {"ratingsCount": -1, "_id": 1}},
    ]
    if limit > 0:
        pipeline.append({"$limit": limit})
    pipeline.append(
        {
            "$project": {
                "slug": 1,
                "title": 1,
                "authors": 1,
                "categories": 1,
                "description": 1,
                "publishedYear": 1,
                "ratingsCount": 1,
            }
        }
    )
    return pipeline


def pick_db(client: MongoClient) -> Database:
    override = os.environ.get("MONGODB_DB", "").strip()
    if override:
        return client[override]
    try:
        default = client.get_default_database()
        if default is not None:
            return default
    except ConfigurationError:
        pass
    for name in client.list_database_names():
        if name in {"admin", "local", "config"}:
            continue
        db = client[name]
        if "books" in db.list_collection_names() and db["books"].estimated_document_count() > 0:
            print(f"Using database '{name}' (found the books collection).")
            return db
    raise SystemExit(
        "Could not find a database with a books collection. "
        "Add the db name to MONGODB_URI or set MONGODB_DB."
    )


def print_coverage(books: Collection, summaries: Collection) -> dict:
    total = books.count_documents({})
    eligible = books.count_documents({"description": {"$type": "string", "$ne": ""}})
    done = summaries.count_documents({})
    leftover = list(
        books.aggregate(
            [
                {"$match": {"description": {"$type": "string", "$ne": ""}}},
                {
                    "$lookup": {
                        "from": "booksummaries",
                        "localField": "_id",
                        "foreignField": "book",
                        "as": "s",
                    }
                },
                {"$match": {"s": {"$size": 0}}},
                {"$count": "n"},
            ]
        )
    )
    remaining = leftover[0]["n"] if leftover else 0
    pct = round((done / total) * 100) if total else 0
    print(
        f"Catalog: {done}/{total} summarized ({pct}%). "
        f"Eligible (have a blurb): {eligible}. Still to write: {remaining}."
    )
    return {
        "total": total,
        "eligible": eligible,
        "done": done,
        "remaining": remaining,
    }


def label_of(book: dict) -> str:
    authors = (book.get("authors") or "").strip()
    title = book.get("title") or "(untitled)"
    return f"{title} by {authors}" if authors else title


def main(argv: list[str]) -> int:
    load_env()
    args = parse_args(argv)

    uri = os.environ.get("MONGODB_URI", "").strip()
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    model = os.environ.get("OPENROUTER_MODEL", "").strip() or DEFAULT_MODEL
    referer = os.environ.get("NEXTAUTH_URL", "").strip() or "http://localhost:3000"

    if not uri:
        sys.stderr.write("MONGODB_URI is not set in .env.local or the environment.\n")
        return 1
    if not args.dry_run and not api_key:
        sys.stderr.write(
            "OPENROUTER_API_KEY is not set — add it to .env.local before running.\n"
            "(--dry-run works without a key.)\n"
        )
        return 1

    deadline = (
        datetime.now(timezone.utc) + timedelta(minutes=args.minutes)
        if args.minutes > 0
        else None
    )

    client = MongoClient(uri)
    db = pick_db(client)
    books = db["books"]
    summaries = db["booksummaries"]

    print_coverage(books, summaries)
    if deadline:
        print(f"This run will stop at {deadline.astimezone().strftime('%H:%M')} local time.")
    if args.dry_run:
        print("(--dry-run: no LLM calls, no writes)")

    stop = {"requested": False}

    def on_sigint(_signum, _frame):
        if stop["requested"]:
            raise SystemExit(130)
        stop["requested"] = True
        print("\nCtrl-C — finishing the current book, then stopping (again to force).")

    signal.signal(signal.SIGINT, on_sigint)

    # Fetch a batch sized for this session so we don't hold the whole remaining
    # catalog in memory. Re-querying each book before write keeps two runners safe.
    fetch_cap = args.limit if args.limit > 0 else 400
    queue = list(books.aggregate(remaining_pipeline(fetch_cap)))
    if not queue:
        print("Nothing to do — every eligible book already has a summary.")
        client.close()
        return 0

    print(f"Queued this session: {len(queue)} (most-reviewed first).")

    generated = skipped = failed = 0
    started = time.monotonic()

    for i, book in enumerate(queue):
        if stop["requested"]:
            print("Stopped early.")
            break
        if deadline and datetime.now(timezone.utc) >= deadline:
            print("Time box reached — stopping. Rerun tomorrow to continue.")
            break
        if args.limit and generated >= args.limit:
            break

        tag = f"[{i + 1}/{len(queue)}] {label_of(book)}"
        if args.dry_run:
            print(f"{tag} … would generate")
            generated += 1
            continue

        print(f"{tag} …", end=" ", flush=True)
        if summaries.find_one({"book": book["_id"]}, {"_id": 1}):
            print("skip (already summarized)")
            skipped += 1
            continue

        book_started = time.monotonic()
        try:
            summary = generate_with_retries(api_key, model, book, referer)
            now = datetime.now(timezone.utc)
            summaries.update_one(
                {"book": book["_id"]},
                {
                    "$set": {
                        "content": summary["content"],
                        "prompt": DEFAULT_BRIEF,
                        "model": summary["model"],
                        "wordCount": summary["wordCount"],
                        "updatedAt": now,
                    },
                    "$inc": {"version": 1},
                    "$setOnInsert": {"createdAt": now},
                },
                upsert=True,
            )
            elapsed = time.monotonic() - book_started
            print(f"ok ({summary['wordCount']} words, {elapsed:.1f}s)")
            generated += 1
        except Exception as err:
            elapsed = time.monotonic() - book_started
            print(f"FAILED ({elapsed:.1f}s) — {err}")
            failed += 1

        if i < len(queue) - 1 and args.sleep_ms > 0:
            time.sleep(args.sleep_ms / 1000)

    total_s = time.monotonic() - started
    print(
        f"Done. generated={generated} skipped={skipped} failed={failed} "
        f"elapsed={total_s:.1f}s"
    )
    print_coverage(books, summaries)
    client.close()
    return 1 if failed > 0 and generated == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
