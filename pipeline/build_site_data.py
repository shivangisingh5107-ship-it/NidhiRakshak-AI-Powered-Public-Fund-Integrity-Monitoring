import json
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
D = PROJECT_DIR / "data"
OUT = PROJECT_DIR / "assets" / "data.js"

files = {
    "national": "national.json",
    "states": "states.json",
    "districts": "districts.json",
    "mps": "mps.json",
    "worksFlagged": "works_flagged.json",
    "worksAll": "works_all.json",
    "reasons": "reasons.json",
    "metrics": "metrics.json",
    "crossScheme": "cross_scheme.json",
    "realMps": "real_mps.json",
    "esakshi": "esakshi_public_snapshot.json",
}

payload = {}
for key, fname in files.items():
    with open(D / fname) as f:
        payload[key] = json.load(f)

with open(OUT, "w") as f:
    f.write("// Auto-generated bundle. Do not edit by hand — regenerate via build_site_data.py\n")
    f.write("window.MPLADS = ")
    json.dump(payload, f, ensure_ascii=False)
    f.write(";\n")

import os
print("Wrote", OUT, os.path.getsize(OUT) / 1e6, "MB")
