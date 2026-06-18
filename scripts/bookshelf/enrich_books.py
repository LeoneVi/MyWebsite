from pathlib import Path
import yaml
import requests

BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "books.yaml"
OUT_FILE = BASE_DIR / "data" / "parsed_books.yaml"

STATIC_BOOK_DIR = BASE_DIR / "static" / "books"
STATIC_BOOK_DIR.mkdir(parents=True, exist_ok=True)

OPENLIBRARY = "https://openlibrary.org"


def get_author_name(author_key):
    r = requests.get(f"{OPENLIBRARY}{author_key}.json", timeout=10)
    if r.status_code != 200: return None
    return r.json().get("name")


def fetch_by_isbn(isbn):
    r = requests.get(f"{OPENLIBRARY}/isbn/{isbn}.json", timeout=10)
    if r.status_code != 200: return None

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
    r = requests.get(f"{OPENLIBRARY}/works/{work_id}.json", timeout=10)
    if r.status_code != 200: return None

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

    r = requests.get(url, timeout=30)

    if r.status_code != 200: return None

    path = STATIC_BOOK_DIR / filename

    with open(path, "wb") as f:
        f.write(r.content)

    return filename



def enrich_book(book):
    isbn = book.get("isbn")
    work_id = book.get("work_id")

    if isbn:
        meta = fetch_by_isbn(isbn)
    elif work_id:
        meta = fetch_by_work(work_id)
    else:
        return book

    if not meta:
        return book

    book.setdefault("meta", {})

    if not book["meta"].get("title"):
        book["meta"]["title"] = meta["title"]

    if not book["meta"].get("author"):
        book["meta"]["author"] = meta["author"]

    if not book["meta"].get("page_count"):
        book["meta"]["page_count"] = meta["page_count"]

    if not book["meta"].get("cover"):
        identifier = isbn or work_id

        filename = f"{identifier}.jpg"
        saved_file = download_cover(meta["cover_url"], filename)

        if saved_file:
            book["meta"]["cover"] = f"/books/{saved_file}"

    return book


with open(IN_PATH, "r", encoding="utf-8") as f:
    books = yaml.safe_load(f)

parsed = []
for book in books:
    enriched_book = enrich_book(book)
    parsed.append(enriched_book)
    print(str(len(parsed)) + " books scanned...")

with open(OUT_FILE, "w", encoding="utf-8") as f:
    yaml.safe_dump(
        parsed,
        f,
        allow_unicode=True,
        sort_keys=False,
    )

print(f"Wrote {OUT_FILE}")