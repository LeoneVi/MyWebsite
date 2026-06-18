from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "read_books.yaml"
OUT_FILE = BASE_DIR / "data" / "read_books.yaml"

with open(IN_PATH, "r", encoding="utf-8") as f:
    books = yaml.safe_load(f)

books.sort(
    key=lambda book: (
        book.get("date_read") is None,
        book.get("date_read") or ""
    ),
    reverse=False
)

dated_books = [b for b in books if b.get("date_read")]
undated_books = [b for b in books if not b.get("date_read")]

dated_books.sort(key=lambda b: b["date_read"], reverse=True)

books = dated_books + undated_books

with open(OUT_FILE, "w", encoding="utf-8") as f:
    yaml.safe_dump(
        books,
        f,
        allow_unicode=True,
        sort_keys=False,
    )

print(f"{len(books)} books sorted in {OUT_FILE.name}")