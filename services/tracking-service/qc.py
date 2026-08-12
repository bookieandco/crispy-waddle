def score_tracks(tracks: list[dict]) -> dict:
    warnings = []
    if not tracks:
        return {"overall": 0, "warnings": ["No tracks returned."]}
    confidences = [float(p.get("confidence", 0)) for t in tracks for p in t.get("points", []) if "confidence" in p]
    gaps = [int(t.get("gapFrames", 0)) for t in tracks]
    switches = sum(int(t.get("identitySwitches", 0)) for t in tracks)
    coverage = sum(float(t.get("coverage", 0)) for t in tracks) / len(tracks)
    confidence = sum(confidences) / len(confidences) if confidences else 0
    score = 100 * (0.45 * coverage + 0.4 * confidence + 0.15 * max(0, 1 - switches / max(1, len(tracks))))
    if switches:
        warnings.append(f"{switches} identity switches detected.")
    if max(gaps, default=0) > 5:
        warnings.append(f"Track gaps exceed 5 frames (max {max(gaps)}).")
    if confidence < 0.7:
        warnings.append("Average tracking confidence is below 0.70.")
    return {"overall": round(max(0, min(100, score)), 1), "coverage": round(coverage, 3), "confidence": round(confidence, 3), "identitySwitches": switches, "warnings": warnings}
