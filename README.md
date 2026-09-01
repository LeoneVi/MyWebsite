# Tory Leone — Personal Website

Personal website built with [Hugo](https://gohugo.io/) and self-hosted on my own [Debian Linux](https://www.debian.org/) home server.

## Tech Stack

* **Hugo** — Static site generator
* **HTML** — Page structure
* **CSS** — Styling
* **JavaScript** — Interactive features
* **Linux / Debian** — Server operating system
* **Nginx** — Web server
* **Git** — Version control

## Adding a translation

Translated pages live beside the English page and use the same filename with a language suffix:

* English: `page-name.en.md`
* Portuguese: `page-name.pt.md`
* Spanish: `page-name.es.md`
* Italian: `page-name.it.md`

Copy the front matter and content into the new sibling file, then translate it. Hugo automatically links files with the same base filename, and the language chooser appears once a page has at least one translation. Do not edit files in `public/`; Hugo regenerates that directory during a build.

## Self-Hosting

The production website is self-hosted on my own home server running Debian Linux.

The server builds and serves the Hugo-generated website using Nginx. The site is accessible publicly through my domain:

**https://toryleone.com**

This setup gives me full control over the website, server, deployment, and infrastructure without relying on a third-party hosting platform.

## Bookshelf maintenance

The bookshelf scripts use a project-local Python environment. Set it up once:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Then enrich newly added books with Open Library metadata and cover images:

```sh
.venv/bin/python scripts/bookshelf/enrich_read_books.py
```

Each entry in `data/read_books.yaml` needs a top-level `work_id`. This is normally
an Open Library work ID, or a stable local slug for books that are not cataloged.
Cover paths are derived automatically as `static/books/<work_id>.webp`; do not add
a `meta.cover` field. The enrichment script resolves work IDs from ISBN or edition
IDs and saves new cover downloads as WebP.

Use `--dry-run` to fetch and report without changing files, or `--refresh` to
retry metadata that Open Library did not have during an earlier run.
