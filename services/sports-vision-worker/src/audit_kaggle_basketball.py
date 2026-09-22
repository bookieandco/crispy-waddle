from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def audit_sqlite(path: Path) -> dict[str, Any]:
    tables: list[dict[str, Any]] = []
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        names = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        for name in names:
            quoted = '"' + name.replace('"', '""') + '"'
            columns = [row[1] for row in connection.execute(f"PRAGMA table_info({quoted})")]
            row_count = int(connection.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0])
            tables.append({"table": name, "columns": columns, "rowCount": row_count})
    finally:
        connection.close()
    return {"kind": "SQLITE", "tables": tables}


def audit_csv(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig", newline="", errors="replace") as handle:
        reader = csv.reader(handle)
        header = next(reader, [])
        row_count = sum(1 for _ in reader)
    return {"kind": "CSV", "columns": header, "rowCount": row_count}


def classify_use(name: str, columns: list[str]) -> list[str]:
    text = " ".join([name, *columns]).lower()
    uses: list[str] = []
    if any(token in text for token in ("player", "roster")):
        uses.append("ROSTER_CROSSCHECK")
    if any(token in text for token in ("box", "score", "pts", "reb", "ast")):
        uses.append("BOX_SCORE_RECONCILIATION")
    if any(token in text for token in ("play_by_play", "playbyplay", "pbp", "event")):
        uses.append("HISTORICAL_CONTEXT")
    if any(token in text for token in ("shot", "tracking", "location", "x_loc", "y_loc")):
        uses.append("CALIBRATION_CORPUS")
    return sorted(set(uses)) or ["HISTORICAL_CONTEXT"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a downloaded basketball dataset without promoting it to physical truth")
    parser.add_argument("dataset_root")
    parser.add_argument("--output", default="artifacts/kaggle/basketball-audit.json")
    args = parser.parse_args()

    root = Path(args.dataset_root).resolve()
    if not root.is_dir():
        raise RuntimeError(f"dataset root does not exist: {root}")

    files: list[dict[str, Any]] = []
    surfaces: list[dict[str, Any]] = []
    suffix_counts: Counter[str] = Counter()

    for path in sorted((p for p in root.rglob("*") if p.is_file()), key=lambda p: p.as_posix()):
        relative = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        suffix_counts[suffix or "<none>"] += 1
        record: dict[str, Any] = {
            "path": relative,
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "suffix": suffix,
        }
        try:
            if suffix in {".sqlite", ".sqlite3", ".db"}:
                detail = audit_sqlite(path)
                record["inspection"] = detail
                for table in detail["tables"]:
                    surfaces.append(
                        {
                            "sourceFile": relative,
                            "surface": table["table"],
                            "columns": table["columns"],
                            "rowCount": table["rowCount"],
                            "allowedUses": classify_use(table["table"], table["columns"]),
                        }
                    )
            elif suffix == ".csv":
                detail = audit_csv(path)
                record["inspection"] = detail
                surfaces.append(
                    {
                        "sourceFile": relative,
                        "surface": Path(relative).stem,
                        "columns": detail["columns"],
                        "rowCount": detail["rowCount"],
                        "allowedUses": classify_use(relative, detail["columns"]),
                    }
                )
        except (OSError, sqlite3.DatabaseError, csv.Error, UnicodeError) as exc:
            record["inspectionError"] = f"{type(exc).__name__}: {exc}"
        files.append(record)

    audit = {
        "schemaVersion": 1,
        "dataset": "wyattowalsh/basketball",
        "source": "KAGGLE",
        "fileCount": len(files),
        "suffixCounts": dict(sorted(suffix_counts.items())),
        "files": files,
        "surfaces": surfaces,
        "quarantine": {
            "physicalInferenceInput": False,
            "hiddenGroundTruthInputBeforeFreeze": False,
            "playerIdentityTruthBeforeFreeze": False,
            "allowedOnlyAfterPhysicalFreezeForReconciliation": True,
        },
        "rule": "Historical/tabular Kaggle evidence may contextualize or reconcile frozen physical inference; it must not establish what the vision system saw.",
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
