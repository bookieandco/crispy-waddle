from dataclasses import dataclass

@dataclass
class PhysicsMetrics:
    frames_simulated: int
    collision_events: int
    penetration_events: int
    invalid_frames: int
    max_penetration: float
    artifact_id: str | None


def score_physics(metrics: PhysicsMetrics) -> dict:
    warnings = []
    score = 100.0
    if not metrics.artifact_id:
        warnings.append("No simulation artifact was produced.")
        score -= 60
    if metrics.frames_simulated <= 0:
        warnings.append("No frames were simulated.")
        score -= 30
    if metrics.invalid_frames:
        warnings.append(f"{metrics.invalid_frames} invalid simulation frames detected.")
        score -= min(30, metrics.invalid_frames * 2)
    if metrics.penetration_events:
        warnings.append(f"{metrics.penetration_events} collision penetration events detected.")
        score -= min(35, metrics.penetration_events)
    if metrics.max_penetration > 0.01:
        warnings.append(f"Maximum penetration is {metrics.max_penetration:.4f} scene units.")
        score -= 15
    return {"overall": round(max(0, min(100, score)), 1), "metrics": metrics.__dict__, "warnings": warnings}
