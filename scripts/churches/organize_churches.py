from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "churches.yaml"
#themes/mytheme/assets/churches
PHOTO_DIR = BASE_DIR / "themes" / "mytheme" / "assets" / "churches"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def get_slug(church):
    name = church["name"].lower().strip().replace(" ", "-")
    location = (
        church["location"]
        .lower()
        .strip()
        .replace(",", "")
        .replace(" ", "-")
    )
    return f"{name}-{location}"


def has_photos(church):
    folder = PHOTO_DIR / get_slug(church)

    if not folder.exists():
        return False

    return any(
        p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        for p in folder.iterdir()
    )


def sort_section(churches):
    with_photos = []
    without_photos = []

    for church in churches:
        if has_photos(church):
            with_photos.append(church)
        else:
            without_photos.append(church)

    with_photos.sort(key=lambda c: c["name"].lower())
    without_photos.sort(key=lambda c: c["name"].lower())

    return with_photos + without_photos


with open(IN_PATH, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

data["roman_catholic"] = sort_section(data["roman_catholic"])
data["other"] = sort_section(data["other"])

with open(IN_PATH, "w", encoding="utf-8") as f:
    yaml.safe_dump(
        data,
        f,
        sort_keys=False,
        allow_unicode=True,
        width=1000,
    )

print("churches.yaml reordered successfully.")