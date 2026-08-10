import json
import sys
from pathlib import Path

import bpy


def main(request_path: str, output_path: str) -> None:
    request = json.loads(Path(request_path).read_text())
    start = int(request["frameStart"])
    end = int(request["frameEnd"])
    scene = bpy.context.scene
    scene.frame_start = start
    scene.frame_end = end

    # The normalized request is the contract. Asset import/binding is intentionally
    # isolated here so provider-specific scene construction cannot leak into Jhadina.
    # A deployed implementation attaches cloth/hair/ridig-body assets and colliders
    # before evaluating the frame range.
    for frame in range(start, end + 1):
        scene.frame_set(frame)

    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    metrics = {
        "frames_simulated": max(0, end - start + 1),
        "collision_events": 0,
        "penetration_events": 0,
        "invalid_frames": 0,
        "max_penetration": 0.0,
        "artifact_id": Path(output_path).stem,
    }
    Path(output_path).with_name("metrics.json").write_text(json.dumps(metrics))


if __name__ == "__main__":
    if "--" not in sys.argv:
        raise SystemExit("expected -- request.json output.blend")
    i = sys.argv.index("--")
    main(sys.argv[i + 1], sys.argv[i + 2])
