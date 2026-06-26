import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ["app", "src", "components", "services", "constants", "store", "lib"]
IMPORT_RE = re.compile(
    r"(?:import|export)\s+(?:[^'\";\n]*?\s+from\s+)?['\"]([^'\"]+)['\"]"
)
EXTS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]


def resolve(from_file: str, spec: str):
    if spec.startswith("@/"):
        base = os.path.join(ROOT, spec[2:])
    elif spec.startswith("."):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    else:
        return "node"
    for ext in EXTS:
        p = base + ext if not ext.startswith("/") else base + ext
        if os.path.isfile(p):
            return p
    if os.path.isfile(base):
        return base
    return None


missing = []
checked = 0
for d in DIRS:
    dp = os.path.join(ROOT, d)
    if not os.path.isdir(dp):
        continue
    for root, _, files in os.walk(dp):
        for fn in files:
            if not fn.endswith((".ts", ".tsx", ".js", ".jsx")):
                continue
            fp = os.path.join(root, fn)
            try:
                text = open(fp, encoding="utf-8").read()
            except OSError:
                continue
            for spec in IMPORT_RE.findall(text):
                if spec.startswith("@") and not spec.startswith("@/"):
                    continue
                if not (spec.startswith(".") or spec.startswith("@/")):
                    continue
                checked += 1
                if resolve(fp, spec) is None:
                    rel = os.path.relpath(fp, ROOT)
                    missing.append((rel, spec))

seen = set()
uniq = []
for item in missing:
    if item not in seen:
        seen.add(item)
        uniq.append(item)

print(f"Checked relative imports: {checked}")
print(f"Missing count: {len(uniq)}")
for f, spec in sorted(uniq):
    print(f"{f} -> {spec}")
