import json
import re

nb_path = r"c:\COLLEGE\Third Year\CC\Innovative\testing\Real Estate Investment Advisor.ipynb"

with open(nb_path, encoding="utf-8") as f:
    nb = json.load(f)

patterns = [
    r"read_csv\s*\(\s*[\"'](.*?)[\"']",
    r"read_excel\s*\(\s*[\"'](.*?)[\"']",
    r"read_json\s*\(\s*[\"'](.*?)[\"']",
    r"read_parquet\s*\(\s*[\"'](.*?)[\"']",
    r"\bopen\s*\(\s*[\"'](.*?)[\"']",
    r"(?:file|path|data|dataset|csv)[\w_]*\s*=\s*[\"'](.*?)[\"']",
    r"(?:PATH|DATA_PATH|DATA_DIR|DATASET_PATH)\s*=\s*[\"'](.*?)[\"']",
]

found = set()
for cell in nb["cells"]:
    if cell["cell_type"] != "code":
        continue
    src = "".join(cell["source"])
    for p in patterns:
        for m in re.findall(p, src, re.IGNORECASE):
            if m and not m.startswith("http") and "{" not in m and len(m) > 1:
                found.add(m)

print("=== FILE REFERENCES FOUND ===")
for x in sorted(found):
    print(repr(x))
print(f"\nTotal: {len(found)}")

# Also show the data-loading cells specifically
print("\n=== CELLS WITH read_csv / read_excel / open ===")
for i, cell in enumerate(nb["cells"]):
    if cell["cell_type"] != "code":
        continue
    src = "".join(cell["source"])
    if re.search(r"read_csv|read_excel|read_json|read_parquet|\bopen\s*\(", src, re.IGNORECASE):
        print(f"\n--- Cell {i} ---")
        print(src[:500])
