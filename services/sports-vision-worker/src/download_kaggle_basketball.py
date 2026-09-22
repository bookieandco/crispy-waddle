from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import kagglehub


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Download a Kaggle dataset and emit a content-addressed receipt")
    parser.add_argument("--dataset", default="wyattowalsh/basketball")
    parser.add_argument("--receipt", default="artifacts/kaggle/basketball-dataset.json")
    args = parser.parse_args()

    if not os.environ.get("KAGGLE_API_TOKEN"):
        raise RuntimeError(
            "KAGGLE_API_TOKEN is required; keep it in the runtime secret store, never source control"
        )

    root = Path(kagglehub.dataset_download(args.dataset)).resolve()
    files = sorted((path for path in root.rglob("*") if path.is_file()), key=lambda path: path.as_posix())

    inventory = []
    total_bytes = 0
    manifest_hasher = hashlib.sha256()
    for path in files:
        relative = path.relative_to(root).as_posix()
        size = path.stat().st_size
        file_hash = sha256_file(path)
        total_bytes += size
        inventory.append(
            {
                "path": relative,
                "bytes": size,
                "sha256": file_hash,
                "suffix": path.suffix.lower(),
            }
        )
        manifest_hasher.update(f"{relative}\0{size}\0{file_hash}\n".encode("utf-8"))

    receipt = {
        "schemaVersion": 2,
        "dataset": args.dataset,
        "auth": "KAGGLE_API_TOKEN",
        "tokenPersisted": False,
        "localPathPersisted": False,
        "fileCount": len(inventory),
        "totalBytes": total_bytes,
        "manifestSha256": manifest_hasher.hexdigest(),
        "files": inventory,
    }

    output = Path(args.receipt)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
