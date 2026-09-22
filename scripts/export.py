"""
Export the books collection to CSV.

Reads MONGODB_URI from .env.local (then .env), the same files the Next app uses.
Every document is included. Nested objects and arrays are written as JSON so
no field is dropped. ObjectIds and dates become strings.

Usage:
  python scripts/export.py
  python scripts/export.py --out books.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import socket
import sys
from datetime import datetime
from pathlib import Path

try:
    from bson import Decimal128, ObjectId
    from pymongo import MongoClient
    from pymongo.database import Database
    from pymongo.errors import ConfigurationError
except ImportError:
    sys.stderr.write("pymongo is missing. Install it with:\n  pip install pymongo\n")
    raise SystemExit(1)

# Stable column order for the fields the app writes. Any extra keys found in
# the documents are appended after these.
PREFERRED_COLUMNS = [
    "_id",
    "isbn13",
    "isbn10",
    "title",
    "subtitle",
    "authors",
    "categories",
    "thumbnail",
    "description",
    "publishedYear",
    "averageRating",
    "numPages",
    "ratingsCount",
    "source",
    "addedBy",
    "slug",
    "olKey",
    "createdAt",
    "updatedAt",
]


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


def use_public_dns() -> None:
    """Resolve Atlas hostnames through public DNS.

    mongodb+srv:// asks the system resolver for an SRV record. On this network
    that resolver (the router) times out, which pymongo reports as
    "The resolution lifetime expired". dnspython and the later socket lookup
    both go through 1.1.1.1 and 8.8.8.8 instead.
    """
    try:
        import dns.resolver
    except ImportError:
        sys.stderr.write("dnspython is missing. Install it with:\n  pip install dnspython\n")
        raise SystemExit(1)

    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
    resolver.timeout = 5
    resolver.lifetime = 15
    dns.resolver.default_resolver = resolver

    original = socket.getaddrinfo

    def getaddrinfo(host, port, *args, **kwargs):
        if isinstance(host, str) and host.endswith(".mongodb.net"):
            try:
                answers = list(resolver.resolve(host, "A"))
            except Exception:
                return original(host, port, *args, **kwargs)
            results = []
            for answer in answers:
                results.extend(original(str(answer), port, *args, **kwargs))
            if results:
                return results
        return original(host, port, *args, **kwargs)

    socket.getaddrinfo = getaddrinfo


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
        if "books" in db.list_collection_names():
            print(f"Using database '{name}' (found the books collection).")
            return db
    raise SystemExit(
        "Could not find a database with a books collection. "
        "Add the db name to MONGODB_URI or set MONGODB_DB."
    )


def cell_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal128):
        return str(value.to_decimal())
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str, ensure_ascii=False)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def flatten(doc: dict) -> dict[str, str]:
    return {key: cell_value(value) for key, value in doc.items()}


def column_order(rows: list[dict[str, str]]) -> list[str]:
    seen: set[str] = set()
    for row in rows:
        seen.update(row.keys())
    ordered = [name for name in PREFERRED_COLUMNS if name in seen]
    extras = sorted(seen - set(ordered))
    return ordered + extras


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the books collection to CSV.")
    parser.add_argument(
        "--out",
        type=Path,
        default=project_root() / "books.csv",
        help="Output CSV path (default: books.csv in the project root).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    load_env()

    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        sys.stderr.write("MONGODB_URI is not set in .env.local or the environment.\n")
        return 1

    if uri.startswith("mongodb+srv://") or ".mongodb.net" in uri:
        print("Resolving Atlas hosts through public DNS (1.1.1.1, 8.8.8.8).")
        use_public_dns()

    client = MongoClient(uri, serverSelectionTimeoutMS=20000)
    try:
        db = pick_db(client)
        books = db["books"]
        total = books.count_documents({})
        print(f"Reading {total} documents from '{db.name}.books'...")

        rows = [flatten(doc) for doc in books.find()]
        columns = column_order(rows)

        out = args.out
        if not out.is_absolute():
            out = Path.cwd() / out
        out.parent.mkdir(parents=True, exist_ok=True)

        # utf-8-sig so Excel on Windows reads non-ASCII titles correctly.
        with out.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

        print(f"Exported {len(rows)} books and {len(columns)} columns to {out}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
