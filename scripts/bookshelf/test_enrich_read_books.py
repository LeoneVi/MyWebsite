import tempfile
import unittest
from pathlib import Path

import enrich_read_books as enrich


class StubClient:
    def __init__(self):
        self.requested_isbn = None
        self.requested_olid = None

    def fetch_by_isbn(self, isbn):
        self.requested_isbn = isbn
        return {
            "title": "Edition title",
            "author": None,
            "page_count": None,
            "cover_url": "https://example.test/isbn-cover.jpg",
        }

    def fetch_by_olid(self, olid):
        self.requested_olid = olid
        return {
            "title": "Work title",
            "author": "Author Name",
            "page_count": 123,
            "cover_url": "https://example.test/cover.jpg",
        }

    def download_cover(self, url, destination):
        destination.write_bytes(b"a real jpeg would be longer than 43 bytes" * 2)
        return True


class StubSession:
    def __init__(self, response):
        self.response = response
        self.headers = {}

    def get(self, url, **kwargs):
        return self.response


class StubResponse:
    status_code = 200
    headers = {"Content-Type": "image/gif"}
    content = b"x" * 43


class EnrichmentTests(unittest.TestCase):
    def test_normalizes_open_library_identifiers(self):
        self.assertEqual(enrich.normalize_olid("/books/OL25576194M"), "OL25576194M")
        self.assertEqual(enrich.normalize_olid("/works/OL17002224W"), "OL17002224W")
        self.assertIsNone(enrich.normalize_olid("OL25576194A"))

    def test_routes_editions_and_works_to_their_correct_endpoints(self):
        client = enrich.OpenLibraryClient()
        requested_paths = []
        client.get_json = lambda path: requested_paths.append(path) or {}

        client.fetch_by_olid("OL25576194M")
        client.fetch_by_olid("OL17002224W")

        self.assertEqual(
            requested_paths,
            ["/books/OL25576194M.json", "/works/OL17002224W.json"],
        )

    def test_combines_sources_without_overwriting_curated_metadata(self):
        book = {
            "isbn": "978-1-234567-89-7",
            "work_id": "OL25576194M",
            "meta": {"title": "My preferred title", "tags": ["music"]},
        }
        client = StubClient()

        with tempfile.TemporaryDirectory() as directory:
            enriched, status = enrich.enrich_book(book, client, Path(directory))

            self.assertEqual(enriched["meta"]["title"], "My preferred title")
            self.assertEqual(enriched["meta"]["author"], "Author Name")
            self.assertEqual(enriched["meta"]["page_count"], 123)
            self.assertEqual(enriched["meta"]["tags"], ["music"])
            self.assertEqual(enriched["meta"]["cover"], "/books/9781234567897.jpg")
            self.assertEqual(status, "enriched")

        self.assertEqual(client.requested_isbn, "9781234567897")
        self.assertEqual(client.requested_olid, "OL25576194M")

    def test_rejects_existing_missing_cover_placeholder(self):
        book = {
            "isbn": "9781234567897",
            "meta": {
                "title": "Title",
                "author": "Author",
                "page_count": 10,
                "cover": "/books/9781234567897.jpg",
            },
        }
        client = StubClient()

        with tempfile.TemporaryDirectory() as directory:
            cover_dir = Path(directory)
            (cover_dir / "9781234567897.jpg").write_bytes(b"x" * 43)
            enriched, status = enrich.enrich_book(book, client, cover_dir)

            self.assertEqual(status, "enriched")
            self.assertGreater((cover_dir / "9781234567897.jpg").stat().st_size, 43)
            self.assertEqual(enriched["meta"]["cover"], "/books/9781234567897.jpg")

    def test_does_not_save_open_library_missing_cover_placeholder(self):
        client = enrich.OpenLibraryClient(session=StubSession(StubResponse()))

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "cover.jpg"
            self.assertFalse(
                client.download_cover("https://example.test/cover", destination)
            )
            self.assertFalse(destination.exists())

    def test_atomic_outputs_are_web_readable(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            image_path = directory / "cover.jpg"
            yaml_path = directory / "books.yaml"

            enrich.atomic_write_bytes(image_path, b"jpeg content")
            enrich.atomic_write_yaml(yaml_path, [{"isbn": "123456789X"}])

            self.assertEqual(image_path.stat().st_mode & 0o777, 0o644)
            self.assertEqual(yaml_path.stat().st_mode & 0o777, 0o644)


if __name__ == "__main__":
    unittest.main()
