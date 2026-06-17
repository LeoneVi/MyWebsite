import csv
import yaml
from pathlib import Path

books = {}

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "books.yaml"

DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

with open("goodreads_library_export.csv", newline="", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        # Only export read books
        if row.get("Exclusive Shelf", "").strip().lower() != "read":
            continue

        title = row["Title"].strip()
        author = row["Author"].strip()

        key = (title, author)

        if key not in books:
            isbn = (
                    row.get("ISBN13", "").strip()
                    or row.get("ISBN", "").strip()
            )

            isbn = isbn.replace("=", "").replace('"', "")

            cover = (
                f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"
                if isbn
                else None
            )

            books[key] = {
                "title": title,
                "author": author,
                "review": None,
                "stars": None,
                "finished_dates": [],
                "cover": cover
            }

        review = row.get("My Review", "").strip()
        if review:
            books[key]["review"] = review
        else:
            books[key]["review"] = "No review given."

        rating = row.get("My Rating", "").strip()
        if rating:
            books[key]["stars"] = int(rating)

        date = row.get("Date Read", "").strip()
        if date and date not in books[key]["finished_dates"]:
            books[key]["finished_dates"].append(date)

data = {"books": list(books.values())}

if DATA_FILE.exists():
    DATA_FILE.unlink()

with open(DATA_FILE, "w", encoding="utf-8") as yamlfile:
    yaml.dump(
        data,
        yamlfile,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False
    )

print(f"Exported {len(data['books'])} books to {DATA_FILE}")