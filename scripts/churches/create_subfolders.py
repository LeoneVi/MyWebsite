from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent.parent.parent

IN_PATH = BASE_DIR / "data" / "churches.yaml"
OUTPATH = BASE_DIR / "static" / "churches"

def get_subfolder_string(church):
    name = church.get("name").lower().strip().replace(" ", "-")
    location = church.get("location").lower().strip().replace(" ", "").replace(",","-")
    subfolder_string = f"{name}-{location}"
    return subfolder_string

with open(IN_PATH, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

churches = data["roman_catholic"] + data["other"]

for church in churches:
    subfolder_string = get_subfolder_string(church)

    dir_path = OUTPATH / subfolder_string

    if not dir_path.exists():
        dir_path.mkdir(parents=True)
        print("created:", dir_path)

