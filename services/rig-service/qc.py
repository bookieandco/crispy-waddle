from dataclasses import dataclass
from typing import Optional

@dataclass
class RigMetrics:
    bone_count: int
    weighted_vertex_ratio: float
    unweighted_vertex_count: int
    orphan_bone_count: int
    degenerate_bone_count: int
    max_influence_count: int
    root_bone_present: bool
    hierarchy_valid: bool
    skin_deformation_ready: bool


def score_rig(metrics: RigMetrics) -> dict:
    warnings = []
    score = 100.0
    if metrics.bone_count <= 0 or not metrics.root_bone_present:
        warnings.append("No valid root/skeleton was detected.")
        score -= 50
    if not metrics.hierarchy_valid:
        warnings.append("Skeleton hierarchy is invalid.")
        score -= 30
    if metrics.unweighted_vertex_count:
        warnings.append(f"{metrics.unweighted_vertex_count} vertices have no skin weights.")
        score -= min(30, metrics.unweighted_vertex_count / 100)
    if metrics.orphan_bone_count:
        warnings.append(f"{metrics.orphan_bone_count} orphan bones detected.")
        score -= min(20, metrics.orphan_bone_count * 2)
    if metrics.degenerate_bone_count:
        warnings.append(f"{metrics.degenerate_bone_count} degenerate bones detected.")
        score -= min(20, metrics.degenerate_bone_count * 2)
    if metrics.max_influence_count > 8:
        warnings.append("Some vertices exceed the recommended influence count.")
        score -= 10
    if not metrics.skin_deformation_ready:
        warnings.append("Skin deformation is not ready for animation.")
        score -= 25
    return {"overall": round(max(0, min(100, score)), 1), "metrics": metrics.__dict__, "warnings": warnings}
