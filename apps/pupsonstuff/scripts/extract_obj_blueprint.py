#!/usr/bin/env python3
"""
Streaming architectural blueprint extractor.

Does NOT attempt to load or decimate the full 1.4M-vertex mesh. Instead:
one streaming pass through the file, tracking the currently-active object
(from "o " lines) and updating a running bounding box + vertex/face count +
material-color tally for that object only. Memory usage stays flat
regardless of file size, since nothing is buffered per-vertex.

This recovers real, measured architectural data (room/wall/door/window
extents, positions, approximate colors) directly from the source blueprint
-- nothing here is fabricated. What it does NOT recover: actual mesh
topology/silhouette (a wall's bounding box is a box, not its real
possibly-non-box shape) -- that's the explicit tradeoff requested: proxy
geometry sized from real measurements, not a decimated copy of the real
mesh.
"""

import re
import json
import sys

WIRE_COLOR_RE = re.compile(r'wire_(\d{3})(\d{3})(\d{3})')

def parse_color_from_material(name):
    m = WIRE_COLOR_RE.match(name)
    if not m:
        return None
    r, g, b = (int(m.group(i)) for i in (1, 2, 3))
    return [r, g, b]


def stream_extract(path, max_lines=None):
    objects = {}  # name -> dict
    order = []
    current_name = None
    current_material_rgb = None

    def get_obj(name):
        if name not in objects:
            objects[name] = {
                "name": name,
                "vertexCount": 0,
                "faceCount": 0,
                "min": [float("inf")] * 3,
                "max": [float("-inf")] * 3,
                "colorCounts": {},  # rgb tuple str -> count of faces using it
            }
            order.append(name)
        return objects[name]

    line_no = 0
    with open(path, "r", errors="ignore") as f:
        for line in f:
            line_no += 1
            if max_lines and line_no > max_lines:
                break

            if line.startswith("o "):
                current_name = line[2:].strip()
                get_obj(current_name)

            elif line.startswith("usemtl "):
                mat_name = line[7:].strip()
                current_material_rgb = parse_color_from_material(mat_name)

            elif line.startswith("v "):
                if current_name is None:
                    current_name = "__ungrouped__"
                    get_obj(current_name)
                obj = objects[current_name]
                parts = line.split()
                try:
                    x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                except (ValueError, IndexError):
                    continue
                obj["vertexCount"] += 1
                mn, mx = obj["min"], obj["max"]
                if x < mn[0]: mn[0] = x
                if y < mn[1]: mn[1] = y
                if z < mn[2]: mn[2] = z
                if x > mx[0]: mx[0] = x
                if y > mx[1]: mx[1] = y
                if z > mx[2]: mx[2] = z

            elif line.startswith("f "):
                if current_name is None:
                    continue
                obj = objects[current_name]
                obj["faceCount"] += 1
                if current_material_rgb:
                    key = tuple(current_material_rgb)
                    obj["colorCounts"][key] = obj["colorCounts"].get(key, 0) + 1

    # finalize: pick the most-used color per object, compute dimensions
    results = []
    for name in order:
        obj = objects[name]
        if obj["vertexCount"] == 0:
            continue
        mn, mx = obj["min"], obj["max"]
        dims = [mx[i] - mn[i] for i in range(3)]
        center = [(mn[i] + mx[i]) / 2 for i in range(3)]
        top_color = None
        if obj["colorCounts"]:
            top_color = max(obj["colorCounts"].items(), key=lambda kv: kv[1])[0]
        results.append({
            "name": name,
            "vertexCount": obj["vertexCount"],
            "faceCount": obj["faceCount"],
            "min": mn,
            "max": mx,
            "dimensions": dims,
            "center": center,
            "color": list(top_color) if top_color else None,
        })
    return results


if __name__ == "__main__":
    path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "blueprint.json"
    results = stream_extract(path)
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Extracted {len(results)} objects -> {out_path}")
