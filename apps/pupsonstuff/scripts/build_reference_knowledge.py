#!/usr/bin/env python3
"""
Builds the reference_knowledge/ library from the real per-object data
already extracted by extract_obj_blueprint.py (blueprint.json). This does
NOT re-derive anything new from the source OBJ -- it's a reorganization +
semantic categorization pass over data that was already measured for real.

Categorization is name-pattern-based (the exporter's own object names,
e.g. "01_Zumtobel_Arcos_track003", "adaptor008", "02_Magis_Chair_One_4Star")
-- these are genuine signals from the source file, not guesses. Objects
that don't match a known pattern go to "uncategorized" honestly, rather
than being forced into a bucket.
"""

import json
import re
import os
import sys

PATTERNS = [
    ("lighting", re.compile(r"zumtobel|arcos|track|spotlight", re.I)),
    ("furniture", re.compile(r"magis|chair", re.I)),
    ("technology", re.compile(r"imac|keyboard", re.I)),
    ("hardware", re.compile(r"^adaptor|^obj3d\d+_", re.I)),
    ("structure_mass", re.compile(r"^box\d+$|^layer_|mall_island|^vm_", re.I)),
    ("generic_geometry", re.compile(r"^object\d*$|^default\d+$|^line\d+$|^shape\d+$|^plane\d+$|^gad\d*$", re.I)),
]

def categorize(name):
    for category, pattern in PATTERNS:
        if pattern.search(name):
            return category
    return "uncategorized"


def build_library(blueprint_path, out_dir):
    objects = json.load(open(blueprint_path))
    os.makedirs(out_dir, exist_ok=True)

    for obj in objects:
        obj["category"] = categorize(obj["name"])

    # semantic_objects.json -- every object with its category
    with open(os.path.join(out_dir, "semantic_objects.json"), "w") as f:
        json.dump(objects, f, indent=2)

    # measured_dimensions.json + bounding_box_library.json -- geometry only
    dims = [{"name": o["name"], "dimensions": o["dimensions"]} for o in objects]
    with open(os.path.join(out_dir, "measured_dimensions.json"), "w") as f:
        json.dump(dims, f, indent=2)

    bboxes = [{"name": o["name"], "min": o["min"], "max": o["max"], "center": o["center"]} for o in objects]
    with open(os.path.join(out_dir, "bounding_box_library.json"), "w") as f:
        json.dump(bboxes, f, indent=2)

    # material_color_library.json -- unique colors actually observed, with usage counts
    color_usage = {}
    for o in objects:
        if o.get("color"):
            key = tuple(o["color"])
            color_usage.setdefault(key, []).append(o["name"])
    material_lib = [
        {"rgb": list(k), "hex": "#%02x%02x%02x" % k, "usedByObjects": v, "usageCount": len(v)}
        for k, v in sorted(color_usage.items(), key=lambda kv: -len(kv[1]))
    ]
    with open(os.path.join(out_dir, "material_color_library.json"), "w") as f:
        json.dump(material_lib, f, indent=2)

    # category-specific pattern files
    by_category = {}
    for o in objects:
        by_category.setdefault(o["category"], []).append(o)

    category_files = {
        "lighting": "lighting_reference.json",
        "furniture": "furniture_patterns.json",
        "hardware": "hardware_patterns.json",
        "structure_mass": "retail_display_patterns.json",
    }
    for cat, filename in category_files.items():
        items = by_category.get(cat, [])
        with open(os.path.join(out_dir, filename), "w") as f:
            json.dump(items, f, indent=2)

    # summary
    summary = {
        "totalObjects": len(objects),
        "byCategory": {cat: len(items) for cat, items in by_category.items()},
        "uniqueColorsObserved": len(material_lib),
    }
    with open(os.path.join(out_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    return summary


if __name__ == "__main__":
    blueprint_path, out_dir = sys.argv[1], sys.argv[2]
    summary = build_library(blueprint_path, out_dir)
    print(json.dumps(summary, indent=2))
