import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRANSCRIPT = r"C:\Users\Ad\.cursor\projects\c-Users-Ad-OneDrive-BLANKET-TECHNOLOGIES-OPC-PRIVATE-LIMITED-Desktop-New-folder-DarziApp\agent-transcripts\fc2240fd-084b-4228-b885-c157cc0b01da\fc2240fd-084b-4228-b885-c157cc0b01da.jsonl"

OUT_PATHS = {
    "customerOrders.ts": os.path.join(ROOT, "src", "types", "customerOrders.ts"),
    "customerOrderService.ts": os.path.join(ROOT, "src", "services", "customerOrderService.ts"),
    "customerOrderStatus.ts": os.path.join(ROOT, "src", "utils", "customerOrderStatus.ts"),
}

files: dict[str, str] = {}
misses: list[str] = []

with open(TRANSCRIPT, encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line)
        for block in obj.get("message", {}).get("content", []):
            if block.get("type") != "tool_use":
                continue
            inp = block.get("input")
            if not isinstance(inp, dict):
                continue
            fp = inp.get("path", "")
            bn = os.path.basename(fp)
            if bn not in OUT_PATHS:
                continue
            if block.get("name") == "Write":
                files[bn] = inp.get("contents", "")
            elif block.get("name") == "StrReplace" and bn in files:
                old = inp.get("old_string", "")
                new = inp.get("new_string", "")
                if old in files[bn]:
                    files[bn] = files[bn].replace(old, new, 1)
                else:
                    misses.append(f"{bn}: {old[:80]!r}")

for bn, out_path in OUT_PATHS.items():
    if bn not in files:
        print("MISSING BASE WRITE:", bn)
        continue
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(files[bn])
    print("WROTE", out_path, len(files[bn]))

print("Replace misses:", len(misses))
for m in misses[:20]:
    print(" ", m)
