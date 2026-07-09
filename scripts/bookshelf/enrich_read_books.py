from pathlib import Path
import yaml
import requests
import time


BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "read_books.yaml"
OUT_FILE = BASE_DIR / "data" / "read_books.yaml"

STATIC_BOOK_DIR = BASE_DIR / "static" / "books"
STATIC_BOOK_DIR.mkdir(parents=True, exist_ok=True)

OPENLIBRARY = "https://openlibrary.org"
failed_books = []

def get(url, retries=8, **kwargs):
    for attempt in range(retries):
        try:
            return requests.get(url, **kwargs)

        except requests.exceptions.RequestException as e:
            wait = min(2 ** attempt, 60)

            print(f"{e}")
            print(f"Waiting {wait} seconds before retrying...")

            time.sleep(wait)

    print(f"Failed to fetch: {url}")
    return None

def get_author_name(author_key):
    r = get(f"{OPENLIBRARY}{author_key}.json", timeout=10)
    if r is None or r.status_code != 200: return None
    return r.json().get("name")


def fetch_by_isbn(isbn):
    r = get(f"{OPENLIBRARY}/isbn/{isbn}.json", timeout=10)
    if r is None or r.status_code != 200: return None

    edition = r.json()

    authors = []

    for author in edition.get("authors", []):
        name = get_author_name(author["key"])
        if name:
            authors.append(name)

    return {
        "title": edition.get("title"),
        "author": ", ".join(authors),
        "page_count": edition.get("number_of_pages"),
        "cover_url": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
    }


def fetch_by_work(work_id):
    r = get(f"{OPENLIBRARY}/works/{work_id}.json", timeout=10)
    if r is None or r.status_code != 200: return None

    work = r.json()

    authors = []

    for author in work.get("authors", []):
        name = get_author_name(author["author"]["key"])
        if name:
            authors.append(name)

    cover_url = None

    covers = work.get("covers")

    if covers:
        cover_url = f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg"

    return {
        "title": work.get("title"),
        "author": ", ".join(authors),
        "page_count": None,
        "cover_url": cover_url,
    }


def download_cover(url, filename):
    if not url: return None
    r = get(url, timeout=30)
    if r is None or r.status_code != 200: return None

    path = STATIC_BOOK_DIR / filename

    with open(path, "wb") as f:
        f.write(r.content)

    return filename



def enrich_book(book):

    # check if book is already enriched, and if so, skip
    meta = book.get("meta", {})

    has_title = bool(meta.get("title"))
    has_author = bool(meta.get("author"))
    has_cover = bool(meta.get("cover"))
    has_pages = bool(meta.get("page_count"))

    if has_title and has_author and has_cover and has_pages:
        print(f"Skipping: {meta.get('title', 'Unknown')}\n")
        return book

    # if book is not enriched, fetch info via OpenLibrary
    isbn = book.get("isbn")
    work_id = book.get("work_id")

    if isbn:
        meta = fetch_by_isbn(isbn)
    elif work_id:
        meta = fetch_by_work(work_id)
    else:
        return book

    if not meta:
        identifier = isbn or work_id
        failed_books.append(identifier)
        print(f"Failed to enrich {identifier}\n")
        return book

    book.setdefault("meta", {})

    if "title" not in book["meta"]:
        book["meta"]["title"] = meta["title"]

    if "author" not in book["meta"]:
        book["meta"]["author"] = meta["author"]

    if "page_count" not in book["meta"]:
        book["meta"]["page_count"] = meta["page_count"]

    if "cover" not in book["meta"]:
        identifier = isbn or work_id

        filename = f"{identifier}.jpg"
        saved_file = download_cover(meta["cover_url"], filename)

        if saved_file:
            book["meta"]["cover"] = f"/books/{saved_file}"

    print(f"Added complete data for {meta.get('title', 'Unknown')}\n")
    return book


with open(IN_PATH, "r", encoding="utf-8") as f:
    books = yaml.safe_load(f)

for i, book in enumerate(books):
    books[i] = enrich_book(book)

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        yaml.safe_dump(
            books,
            f,
            allow_unicode=True,
            sort_keys=False,
        )

    print(f"{i + 1}/{len(books)} books scanned")

print(f"\nWrote {OUT_FILE}")

if failed_books:
    print("\nThe following books could not be enriched:")

    for book in failed_books:
        print(f"  - {book}")
else:
    print("\nAll books were enriched successfully.")