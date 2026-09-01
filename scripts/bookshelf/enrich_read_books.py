#!/usr/bin/env python3
"""Fill missing bookshelf metadata from Open Library."""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

try:
    import requests
    import yaml
except ModuleNotFoundError as exc:
    dependency = "PyYAML" if exc.name == "yaml" else exc.name
    raise SystemExit(
        f"Missing Python dependency: {dependency}.\n"
        "Run `.venv/bin/python -m pip install -r requirements.txt`, then use "
        "`.venv/bin/python scripts/bookshelf/enrich_read_books.py`."
    ) from exc


BASE_DIR = Path(__file__).resolve().parent.parent.parent
BOOKS_FILE = BASE_DIR / "data" / "read_books.yaml"
STATIC_BOOK_DIR = BASE_DIR / "static" / "books"

OPEN_LIBRARY = "https://openlibrary.org"
COVERS = "https://covers.openlibrary.org"
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
METADATA_FIELDS = ("title", "author", "page_count", "cover")
DEFAULT_PLACEHOLDER_SIZE = 43


class OpenLibraryClient:
    def __init__(self, retries: int = 4, session: requests.Session | None = None):
        self.retries = retries
        self.session = session or requests.Session()
        self.author_names: dict[str, str | None] = {}
        self.session.headers.update(
            {"User-Agent": "ToryLeone.com bookshelf metadata enrichment/1.0"}
        )

    def get(self, url: str, **kwargs: Any) -> requests.Response | None:
        """GET a URL, retrying transient network and server failures."""
        for attempt in range(self.retries):
            try:
                response = self.session.get(url, **kwargs)
            except requests.exceptions.RequestException as exc:
                response = None
                error = str(exc)
            else:
                if response.status_code not in RETRYABLE_STATUS_CODES:
                    return response
                error = f"HTTP {response.status_code}"

            if attempt == self.retries - 1:
                break

            retry_after = (
                response.headers.get("Retry-After") if response is not None else None
            )
            try:
                wait = min(float(retry_after), 60) if retry_after else 2**attempt
            except ValueError:
                wait = 2**attempt

            print(f"{error}; retrying in {wait:g} seconds...")
            time.sleep(wait)

        print(f"Failed to fetch after {self.retries} attempts: {url}")
        return None

    def get_json(self, path: str) -> dict[str, Any] | None:
        response = self.get(f"{OPEN_LIBRARY}{path}", timeout=15)
        if response is None or response.status_code != 200:
            return None

        try:
            payload = response.json()
        except requests.exceptions.JSONDecodeError:
            print(f"Open Library returned invalid JSON for {path}")
            return None

        return payload if isinstance(payload, dict) else None

    def get_author_name(self, author_key: str) -> str | None:
        key = normalize_open_library_path(author_key, "authors")
        if not key:
            return None
        if key in self.author_names:
            return self.author_names[key]
        author = self.get_json(f"{key}.json")
        self.author_names[key] = clean_text(author.get("name")) if author else None
        return self.author_names[key]

    def metadata_from_record(self, record: dict[str, Any]) -> dict[str, Any]:
        authors = []
        for author_ref in record.get("authors") or []:
            if not isinstance(author_ref, dict):
                continue

            # Edition records use {"key": ...}; work records wrap it in "author".
            nested_ref = author_ref.get("author")
            if isinstance(nested_ref, dict):
                author_ref = nested_ref

            author_key = author_ref.get("key")
            if author_key:
                name = self.get_author_name(str(author_key))
                if name and name not in authors:
                    authors.append(name)

        cover_url = None
        covers = record.get("covers") or []
        if covers and str(covers[0]).lstrip("-").isdigit() and int(covers[0]) > 0:
            cover_url = f"{COVERS}/b/id/{covers[0]}-L.jpg?default=false"

        return {
            "title": clean_text(record.get("title")),
            "author": ", ".join(authors) or None,
            "page_count": positive_int(record.get("number_of_pages")),
            "cover_url": cover_url,
        }

    def fetch_by_isbn(self, isbn: str) -> dict[str, Any] | None:
        record = self.get_json(f"/isbn/{isbn}.json")
        if not record:
            return None

        metadata = self.metadata_from_record(record)
        if not metadata["cover_url"]:
            metadata["cover_url"] = (
                f"{COVERS}/b/isbn/{isbn}-L.jpg?default=false"
            )
        return metadata

    def fetch_by_olid(self, identifier: str) -> dict[str, Any] | None:
        olid = normalize_olid(identifier)
        if not olid:
            return None

        if olid.endswith("M"):
            path = f"/books/{olid}.json"
        elif olid.endswith("W"):
            path = f"/works/{olid}.json"
        else:
            return None

        record = self.get_json(path)
        return self.metadata_from_record(record) if record else None

    def download_cover(self, url: str, destination: Path) -> bool:
        response = self.get(url, timeout=30)
        if response is None or response.status_code != 200:
            return False

        content_type = response.headers.get("Content-Type", "").lower()
        if not content_type.startswith("image/"):
            return False

        # Open Library's legacy missing-cover response is a 43-byte, 1x1 GIF.
        if len(response.content) <= DEFAULT_PLACEHOLDER_SIZE:
            return False

        destination.parent.mkdir(parents=True, exist_ok=True)
        atomic_write_bytes(destination, response.content)
        return True


def clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def positive_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def normalize_isbn(value: Any) -> str | None:
    if value is None:
        return None
    isbn = re.sub(r"[-\s]", "", str(value))
    return isbn.upper() if re.fullmatch(r"(?:\d{9}[\dX]|\d{13})", isbn, re.I) else None


def normalize_olid(value: Any) -> str | None:
    if value is None:
        return None
    match = re.search(r"\b(OL\d+[MW])\b", str(value), re.I)
    return match.group(1).upper() if match else None


def normalize_open_library_path(value: Any, resource: str) -> str | None:
    if value is None:
        return None
    match = re.search(rf"(?:/{resource}/)?(OL\d+[A-Z])", str(value), re.I)
    return f"/{resource}/{match.group(1).upper()}" if match else None


def merge_metadata(*sources: dict[str, Any] | None) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "title": None,
        "author": None,
        "page_count": None,
        "cover_url": None,
    }
    for source in sources:
        if not source:
            continue
        for key in merged:
            if merged[key] in (None, "") and source.get(key) not in (None, ""):
                merged[key] = source[key]
    return merged


def safe_filename_stem(isbn: str | None, olid: str | None) -> str:
    return isbn or olid or "unknown-book"


def local_cover_is_invalid(cover: Any, cover_dir: Path) -> bool:
    if not isinstance(cover, str) or not cover.startswith("/books/"):
        return False
    cover_file = cover_dir / Path(cover).name
    try:
        return not cover_file.is_file() or cover_file.stat().st_size <= DEFAULT_PLACEHOLDER_SIZE
    except OSError:
        return True


def enrich_book(
    book: dict[str, Any],
    client: OpenLibraryClient,
    cover_dir: Path,
    refresh: bool = False,
    download_dir: Path | None = None,
) -> tuple[dict[str, Any], str]:
    meta = book.setdefault("meta", {})
    if not isinstance(meta, dict):
        raise ValueError("book 'meta' must be a mapping")

    invalid_cover = local_cover_is_invalid(meta.get("cover"), cover_dir)
    if invalid_cover:
        meta["cover"] = None

    if (
        not refresh
        and not invalid_cover
        and all(field in meta for field in METADATA_FIELDS)
    ):
        return book, "skipped"

    isbn = normalize_isbn(book.get("isbn"))
    olid = normalize_olid(book.get("edition_id") or book.get("work_id"))
    if not isbn and not olid:
        return book, "no identifier"

    isbn_metadata = client.fetch_by_isbn(isbn) if isbn else None
    olid_metadata = client.fetch_by_olid(olid) if olid else None
    fetched = merge_metadata(isbn_metadata, olid_metadata)
    if isbn_metadata is None and olid_metadata is None:
        return book, "lookup failed"

    for field in ("title", "author", "page_count"):
        if not meta.get(field) and fetched[field] is not None:
            meta[field] = fetched[field]
        elif field not in meta:
            # Record that Open Library was checked but has no value. Use --refresh
            # to retry later if its catalog is updated.
            meta[field] = None

    if not meta.get("cover"):
        cover_url = fetched["cover_url"]
        cover_stem = safe_filename_stem(isbn, olid)
        cover_file = (download_dir or cover_dir) / f"{cover_stem}.jpg"
        if cover_url and client.download_cover(cover_url, cover_file):
            meta["cover"] = f"/books/{cover_file.name}"
        else:
            meta["cover"] = None

    missing = [field for field in METADATA_FIELDS if not meta.get(field)]
    return book, f"missing {', '.join(missing)}" if missing else "enriched"


def atomic_write_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as temporary_file:
            temporary_file.write(content)
        os.chmod(temporary_name, 0o644)
        os.replace(temporary_name, path)
    except BaseException:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def atomic_write_yaml(path: Path, books: list[dict[str, Any]]) -> None:
    serialized = yaml.safe_dump(
        books,
        allow_unicode=True,
        sort_keys=False,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as temporary_file:
            temporary_file.write(serialized)
        os.chmod(temporary_name, 0o644)
        os.replace(temporary_name, path)
    except BaseException:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def load_books(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as books_file:
        books = yaml.safe_load(books_file)

    if not isinstance(books, list):
        raise ValueError(f"{path} must contain a YAML list")
    for index, book in enumerate(books, start=1):
        if not isinstance(book, dict):
            raise ValueError(f"book {index} in {path} must be a mapping")
    return books


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch metadata and report changes without writing files",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="retry fields previously recorded as unavailable",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        books = load_books(BOOKS_FILE)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f"Could not load bookshelf data: {exc}", file=sys.stderr)
        return 1

    client = OpenLibraryClient()
    failures = []
    temporary_cover_dir = tempfile.TemporaryDirectory() if args.dry_run else None
    cover_dir = (
        Path(temporary_cover_dir.name) if temporary_cover_dir else STATIC_BOOK_DIR
    )

    try:
        for index, book in enumerate(books, start=1):
            label = (
                (book.get("meta") or {}).get("title")
                if isinstance(book.get("meta"), dict)
                else None
            ) or book.get("isbn") or book.get("edition_id") or book.get("work_id")
            try:
                books[index - 1], status = enrich_book(
                    book,
                    client,
                    STATIC_BOOK_DIR,
                    refresh=args.refresh,
                    download_dir=cover_dir,
                )
            except (OSError, ValueError) as exc:
                status = f"error: {exc}"

            print(f"[{index}/{len(books)}] {label}: {status}")
            if status.startswith(("lookup failed", "error:")):
                failures.append(str(label))
    finally:
        if temporary_cover_dir:
            temporary_cover_dir.cleanup()

    if args.dry_run:
        print("\nDry run complete; no files were written.")
    else:
        atomic_write_yaml(BOOKS_FILE, books)
        print(f"\nWrote {BOOKS_FILE}")

    if failures:
        print("Could not enrich:")
        for label in failures:
            print(f"  - {label}")
        return 1

    print("All identifiable books were scanned successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
