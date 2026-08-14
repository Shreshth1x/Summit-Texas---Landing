#!/usr/bin/env python3
"""Case-sensitive internal link checker for the Silicon Hills Project site.

The live host (Vercel) is case-sensitive; macOS is not, so a link that
works locally can 404 in production. Run this before pushing:

    python3 tools/check-links.py

It scans every tracked .html file for internal href/src values and fails
(exit 1) if a target doesn't resolve — matching path case EXACTLY the way
the server does, and understanding cleanUrls (/notes/foo -> notes/foo.html,
/notes -> notes/index.html).
"""

import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATTR_RE = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
SKIP_PREFIXES = ("http://", "https://", "mailto:", "tel:", "data:", "#", "//")

# Old URLs that intentionally live on as vercel.json redirects.
REDIRECTED = set()
try:
    import json
    with open(os.path.join(ROOT, "vercel.json")) as f:
        for rule in json.load(f).get("redirects", []):
            REDIRECTED.add(urllib.parse.unquote(rule["source"]))
except (OSError, ValueError, KeyError):
    pass


def exists_case_sensitive(path):
    """True if path exists with this exact spelling (component by component)."""
    if not os.path.exists(path):
        return False
    current = ROOT
    rel = os.path.relpath(path, ROOT)
    for part in rel.split(os.sep):
        if part == ".":
            continue
        if part not in os.listdir(current):
            return False
        current = os.path.join(current, part)
    return True


def resolves(url_path):
    """Resolve an absolute site path the way Vercel (cleanUrls) would."""
    clean = urllib.parse.unquote(url_path.split("#")[0].split("?")[0])
    if clean in REDIRECTED:
        return True
    fs = os.path.join(ROOT, clean.lstrip("/"))
    candidates = [fs]
    if not clean.endswith((".html", "/")):
        candidates.append(fs + ".html")
    candidates.append(os.path.join(fs, "index.html"))
    return any(exists_case_sensitive(c) for c in candidates)


def html_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", "tmp", "outputs"}]
        for name in filenames:
            if name.endswith(".html"):
                yield os.path.join(dirpath, name)


def main():
    problems = []
    for path in html_files():
        rel_file = os.path.relpath(path, ROOT)
        base_dir = os.path.dirname(path)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        # Blank out HTML comments (keep newlines so line numbers stay right).
        text = re.sub(
            r"<!--.*?-->",
            lambda m: re.sub(r"[^\n]", " ", m.group(0)),
            text,
            flags=re.DOTALL,
        )
        for match in ATTR_RE.finditer(text):
            url = match.group(1).strip()
            if not url or url.startswith(SKIP_PREFIXES):
                continue
            line = text.count("\n", 0, match.start()) + 1
            if url.startswith("/"):
                ok = resolves(url)
            else:
                # Relative link: resolve against the file's own directory.
                clean = urllib.parse.unquote(url.split("#")[0].split("?")[0])
                target = os.path.normpath(os.path.join(base_dir, clean))
                ok = exists_case_sensitive(target) or exists_case_sensitive(target + ".html")
            if not ok:
                problems.append(f"{rel_file}:{line}  broken link  {url}")
            elif " " in urllib.parse.unquote(url) or url != url.lower():
                # Resolves today, but spaces/capitals invite the macOS-vs-Vercel case trap.
                problems.append(f"{rel_file}:{line}  WARNING: spaces/capitals in internal link  {url}")

    if problems:
        print("\n".join(problems))
        broken = [p for p in problems if "broken link" in p]
        if broken:
            print(f"\n{len(broken)} broken link(s).")
            return 1
        print(f"\n{len(problems)} warning(s), no broken links.")
        return 0
    print("All internal links resolve (case-sensitive). ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
