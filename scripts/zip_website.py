import subprocess
import sys
import zipfile
from pathlib import Path
from tkinter import Tk
from tkinter.filedialog import asksaveasfilename

IMAGE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    ".svg", ".ico", ".tiff", ".tif", ".heic", ".avif",
}

EXCLUDED_EXTENSIONS = {
    ".csv",
}

EXCLUDED_DIRS = {
    ".venv",
    "venv",
    ".git",
    ".idea",
    ".vscode",
    "public",
    "resources",
    "node_modules",
    "__pycache__",
}

EXCLUDED_FILES = {
    ".hugo_build.lock",
    ".DS_Store",
}


def is_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_EXTENSIONS


def is_excluded(path: Path, source_dir: Path) -> bool:
    """True if any parent directory, the filename, or the extension is excluded."""
    relative_parts = path.relative_to(source_dir).parts
    # Check every directory component in the relative path (catches nested occurrences too)
    if any(part in EXCLUDED_DIRS for part in relative_parts[:-1]):
        return True
    if path.name in EXCLUDED_FILES:
        return True
    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return True
    return False


def reveal_in_file_manager(path: Path) -> None:
    """Open the system file manager and highlight the file, if possible."""
    try:
        if sys.platform == "darwin":
            subprocess.run(["open", "-R", str(path)])
        elif sys.platform.startswith("win"):
            subprocess.run(["explorer", "/select,", str(path)])
        else:
            subprocess.run(["xdg-open", str(path.parent)])
    except Exception:
        pass


def ask_save_path(default_name: str) -> Path | None:
    """Pop up a native 'Save As' dialog and return the chosen path, or None if cancelled."""
    root = Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    chosen = asksaveasfilename(
        title="Save website zip as...",
        defaultextension=".zip",
        initialfile=default_name,
        filetypes=[("Zip files", "*.zip")],
    )
    root.destroy()
    return Path(chosen) if chosen else None


def zip_folder(source_dir: Path, output_zip: Path) -> None:
    file_count = 0
    skipped_images = 0
    skipped_excluded = 0

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in source_dir.rglob("*"):
            if path.is_dir():
                continue

            # Don't zip the output file into itself if it's inside source_dir
            if path.resolve() == output_zip.resolve():
                continue

            if is_excluded(path, source_dir):
                skipped_excluded += 1
                continue

            if is_image(path):
                skipped_images += 1
                continue

            arcname = path.relative_to(source_dir)
            zf.write(path, arcname)
            file_count += 1

    print(f"Done: {output_zip}")
    print(f"  Files added:      {file_count}")
    print(f"  Images skipped:   {skipped_images}")
    print(f"  Excluded skipped: {skipped_excluded}")


def main():
    script_dir = Path(__file__).resolve().parent
    default_source = script_dir.parent

    if len(sys.argv) >= 2:
        source_dir = Path(sys.argv[1]).expanduser().resolve()
    else:
        source_dir = default_source

    if not source_dir.is_dir():
        print(f"Error: '{source_dir}' is not a valid directory.")
        sys.exit(1)

    if len(sys.argv) >= 3:
        output_zip = Path(sys.argv[2]).expanduser().resolve()
    else:
        default_name = f"{source_dir.name}.zip"
        chosen = ask_save_path(default_name)
        if chosen is None:
            print("Save cancelled.")
            sys.exit(0)
        output_zip = chosen.expanduser().resolve()

    zip_folder(source_dir, output_zip)
    reveal_in_file_manager(output_zip)


if __name__ == "__main__":
    main()