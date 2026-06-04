#!/usr/bin/env python3
"""Build installable Tab Tools packages for Chrome and Firefox.

Usage:
    python3 build.py            # build both
    python3 build.py chrome     # build only chrome
    python3 build.py firefox    # build only firefox

Output: dist/tab-tools-<browser>-v<version>.zip
Each zip has manifest.json at its root, ready to load/submit.
"""

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

BUILDS = {
    "chrome": "tab_tools_chrome",
    "firefox": "tab_tools_firefox",
}

# Names excluded anywhere in the tree.
EXCLUDE_DIRS = {"web-ext-artifacts", ".claude", "__pycache__", ".git", "dist", "node_modules"}
EXCLUDE_FILES = {".DS_Store", "Thumbs.db"}
EXCLUDE_SUFFIXES = {".zip"}


def manifest_version(folder: Path) -> str:
    with open(folder / "manifest.json", encoding="utf-8") as fh:
        return json.load(fh)["version"]


def iter_files(folder: Path):
    for path in sorted(folder.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(folder)
        if any(part in EXCLUDE_DIRS for part in rel.parts):
            continue
        if rel.name in EXCLUDE_FILES or rel.suffix in EXCLUDE_SUFFIXES:
            continue
        yield path, rel


def build(name: str) -> Path:
    folder = ROOT / BUILDS[name]
    if not (folder / "manifest.json").exists():
        sys.exit(f"error: {folder}/manifest.json not found")
    version = manifest_version(folder)
    DIST.mkdir(exist_ok=True)
    out = DIST / f"tab-tools-{name}-v{version}.zip"
    if out.exists():
        out.unlink()

    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, rel in iter_files(folder):
            zf.write(path, rel.as_posix())
            count += 1

    size_kb = out.stat().st_size / 1024
    print(f"  {name:8} v{version}  →  {out.relative_to(ROOT)}  ({count} files, {size_kb:.0f} KB)")
    return out


def main() -> None:
    targets = [a.lower() for a in sys.argv[1:]] or list(BUILDS)
    unknown = [t for t in targets if t not in BUILDS]
    if unknown:
        sys.exit(f"unknown target(s): {', '.join(unknown)}. Choose from: {', '.join(BUILDS)}")

    print("Building Tab Tools…")
    for name in targets:
        build(name)

    print("\nDone. Packages are in dist/\n")
    print("Install locally:")
    if "chrome" in targets:
        print("  Chrome  → chrome://extensions → enable Developer mode → either")
        print("            'Load unpacked' on the tab_tools_chrome/ folder, or")
        print("            unzip the chrome zip and load that folder.")
    if "firefox" in targets:
        print("  Firefox → about:debugging#/runtime/this-firefox →")
        print("            'Load Temporary Add-on…' → pick the firefox zip")
        print("            (removed on restart; permanent install needs AMO signing).")


if __name__ == "__main__":
    main()
