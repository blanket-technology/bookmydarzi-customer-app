import json
import os
import re

TRANSCRIPT = r"C:\Users\Ad\.cursor\projects\c-Users-Ad-OneDrive-BLANKET-TECHNOLOGIES-OPC-PRIVATE-LIMITED-Desktop-New-folder-DarziApp\agent-transcripts\fc2240fd-084b-4228-b885-c157cc0b01da\fc2240fd-084b-4228-b885-c157cc0b01da.jsonl"
TARGET = "index.tsx"
TARGET_PATH_FRAGMENT = r"app\(tabs)\index.tsx"

content = None
misses = []

with open(TRANSCRIPT, encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line)
        for block in obj.get("message", {}).get("content", []):
            if block.get("type") != "tool_use":
                continue
            name = block.get("name")
            inp = block.get("input")
            if not isinstance(inp, dict):
                continue
            fp = inp.get("path", "")
            if TARGET not in fp.replace("/", "\\") or "(tabs)" not in fp.replace("/", "\\"):
                continue

            if name == "Write":
                content = inp.get("contents", "")
            elif name == "StrReplace" and content is not None:
                old = inp.get("old_string", "")
                new = inp.get("new_string", "")
                if old in content:
                    content = content.replace(old, new, 1)
                else:
                    misses.append(f"StrReplace: {old[:60]!r}")
            elif name == "ApplyPatch" and content is not None:
                patch = inp.get("patch") or inp.get("*** Begin Patch") or str(inp)
                if isinstance(inp, str):
                    patch = inp
                # ApplyPatch stored as string in input sometimes
                patch_text = inp if isinstance(inp, str) else inp.get("patch", "")
                if not patch_text and "patch" in inp:
                    patch_text = inp["patch"]
                if not patch_text:
                    # full input may be the patch string under ApplyPatch
                    patch_text = json.dumps(inp)
                for hunk in re.findall(
                    r"\*\*\* Update File:[^\n]*\n(.*?)(?=\*\*\* End Patch|\Z)",
                    patch_text,
                    re.S,
                ):
                    for m in re.finditer(
                        r"@@\n(.*?)(?=\n@@|\Z)", hunk, re.S
                    ):
                        body = m.group(1)
                        old_lines = []
                        new_lines = []
                        for ln in body.splitlines():
                            if not ln:
                                continue
                            if ln.startswith("-"):
                                old_lines.append(ln[1:])
                            elif ln.startswith("+"):
                                new_lines.append(ln[1:])
                            else:
                                old_lines.append(ln)
                                new_lines.append(ln)
                        old_block = "\n".join(old_lines)
                        new_block = "\n".join(new_lines)
                        if old_block in content:
                            content = content.replace(old_block, new_block, 1)
                        else:
                            misses.append(f"Patch: {old_block[:60]!r}")

if content:
    out = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app",
        "(tabs)",
        "index.tsx",
    )
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    print("WROTE", out, "lines", content.count("\n") + 1)
else:
    print("NO BASE CONTENT FOUND")

print("Misses:", len(misses))
for m in misses[:15]:
    print(" ", m)
