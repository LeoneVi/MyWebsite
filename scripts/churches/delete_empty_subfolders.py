from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "churches.yaml"
OUTPATH = BASE_DIR / "assets" / "churches"

for folder in sorted(OUTPATH.rglob("*"), reverse=True):
    if folder.is_dir():
        if not any(folder.iterdir()):
            folder.rmdir()
            print(f"Deleted empty folder: {folder}")