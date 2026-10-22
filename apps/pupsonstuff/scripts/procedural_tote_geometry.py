#!/usr/bin/env python3
"""Pure-CPU construction of a measured tote prototype; no Blender import.

Physical dimensions and handle profile MUST come from supplier/sample
evidence; never treat existing generic tote.glb dimensions as SKU proof.
Generated geometry is not production-certified or automatically installed.
"""
import math

REQUIRED = ("bodyHeightMm", "handleDropMm", "strapWidthMm", "strapThicknessMm",
            "handleAnchorSpacingMm", "measurementEvidence")


def validate_tote_dimensions(spec, overall_mm):
    if not isinstance(spec, dict) or not isinstance(overall_mm, (tuple, list)) or len(overall_mm) != 3:
        raise ValueError("VERIFIED_TOTE_DIMENSIONS_REQUIRED")
    for k in REQUIRED:
        v = spec.get(k)
        if k == "measurementEvidence":
            if not isinstance(v, str) or len(v.strip()) < 16 or any(t in v.lower() for t in ("placeholder", "synthetic", "todo")):
                raise ValueError("TOTE_SPEC_EVIDENCE_UNVERIFIED")
        elif type(v) not in (int, float) or not math.isfinite(v) or v <= 0 or v > 3000:
            raise ValueError("TOTE_MEASUREMENT_MISSING_OR_INVALID:" + k)
    if any(type(v) not in (int, float) or not math.isfinite(v) or v <= 0 or v > 3000 for v in overall_mm):
        raise ValueError("VERIFIED_TOTE_DIMENSIONS_REQUIRED")
    width, overall_height, depth = map(float, overall_mm)
    body = float(spec["bodyHeightMm"])
    handle = float(spec["handleDropMm"])
    spacing = float(spec["handleAnchorSpacingMm"])
    strap = float(spec["strapWidthMm"])
    thickness = float(spec["strapThicknessMm"])
    if abs(body + handle - overall_height) > 3:
        raise ValueError("TOTE_TOTAL_HEIGHT_NOT_EQUAL_BODY_PLUS_HANDLE_DROP")
    if spacing >= width * 0.85 or spacing < strap * 3:
        raise ValueError("TOTE_HANDLE_ANCHOR_SPACING_INVALID")
    if strap >= min(width * 0.20, body * 0.2) or thickness >= min(depth*0.15, strap*0.5):
        raise ValueError("TOTE_STRAP_WIDTH_THICKNESS_INVALID")
    if depth >= width * 0.8 or body < width * 0.4:
        raise ValueError("TOTE_PHYSICAL_PROPORTIONS_SUSPICIOUS")
    return tuple(float(v) / 1000 for v in overall_mm)


def body_ring(width, depth, z, frac, segments=8):
    """Rounded panel/corner perimeter; slight deterministic cloth drape."""
    r = min(width, depth) * .12
    hw, hd = width / 2, depth / 2
    # [center x, center y, angle start] in right-handed CCW path.
    corners = [
        ( hw-r, -hd+r, -math.pi/2),
        ( hw-r,  hd-r,  0.0),
        (-hw+r,  hd-r,  math.pi/2),
        (-hw+r, -hd+r,  math.pi),
    ]
    result = []
    # Smooth ring with no thin rectangle corners; gusset remains visible.
    for cx, cy, start in corners:
        for k in range(segments + 1):
            theta=start + (math.pi / 2) * (k / segments)
            x=cx + r * math.cos(theta)
            y=cy + r * math.sin(theta)
            # Fold amplitude below 0.8% of the bag depth.
            y+= .006 * depth * math.sin(4 * math.pi * x/width) * math.sin(math.pi*frac)
            result.append((x,y,z))
    return result


def build_geometry(physical_mm, spec):
    """One candidate GLB mesh with two handle ribbon surfaces and UVs.

    Returns position/index/UV arrays in Blender Z-up coordinates. Separate
    handle islands still require topology/visual review; this is NOT a
    watertight or physically certified garment.
    """
    width, total_h, depth=validate_tote_dimensions(spec, physical_mm)
    body_h=float(spec["bodyHeightMm"])/1000
    drop=float(spec["handleDropMm"])/1000
    spacing=float(spec["handleAnchorSpacingMm"])/1000
    strap=float(spec["strapWidthMm"])/1000
    thickness=float(spec["strapThicknessMm"])/1000
    verts=[]
    faces=[]
    uv=[]
    def append(v,t):
        verts.append(v)
        uv.append(t)
        return len(verts)-1
    body_steps=26
    ring_len=36
    # zero-centered overall height, just like the existing product viewer.
    z0=-total_h/2
    for j in range(body_steps+1):
        f=j/body_steps
        # Gentle hem taper instead of a cuboid. Width broadest near top.
        shaped_w=width * (.965 + .035*f)
        ring=body_ring(shaped_w,depth,z0+body_h*f,f)
        assert len(ring)==ring_len
        for i,p in enumerate(ring):
            append(p,(i/ring_len,f))
        if j:
            for i in range(ring_len):
                a=(j-1)*ring_len+i
                b=(j-1)*ring_len+(i+1)%ring_len
                c=j*ring_len+(i+1)%ring_len
                d=j*ring_len+i
                faces.extend(((a,b,d),(b,c,d)))
    # Bottom side is capped; bag top remains open intentionally.
    center=append((0,0,z0),(.5,.5))
    for i in range(ring_len):
        faces.append((center,(i+1)%ring_len,i))
    # Two natural fabric handles, one on each physical side. They meet the
    # top seam but remain separately constructed islands pending retopology.
    for side in (-1,1):
        start_index=len(verts)
        sections=48
        for n in range(sections+1):
            t=n/sections
            x=spacing*(t-.5)
            z=z0+body_h+drop*math.sin(math.pi*t)
            dx=spacing
            dz=drop*math.pi*math.cos(math.pi*t)
            norm=math.hypot(dx,dz)
            nx,nz=-dz/norm,dx/norm
            y=side*(depth/2+thickness*.3)
            for yoff in (-thickness/2,thickness/2):
                for sign in (-1,1):
                    append((x+sign*strap*nx/2,y+yoff,z+sign*strap*nz/2),
                           (float(sign+1)/2,t))
        for n in range(sections):
            a=start_index+n*4
            b=a+4
            faces.extend(((a,a+1,b),(a+1,b+1,b),
                          (a+2,a+3,b+2),(a+3,b+3,b+2),
                          (a,a+2,b),(a+2,b+2,b),
                          (a+1,b+1,a+3),(a+3,b+1,b+3)))
    return {"vertices":verts,"faces":faces,"uv":uv,"units":"meters",
            "source":"supplier-metrics-required","storefrontApproved":False,
            "watertightApproved":False,"printifyPrintZoneCertified":False}


def measured_bounds(geometry):
    vertices=geometry["vertices"]
    lower=tuple(min(v[i] for v in vertices) for i in range(3))
    upper=tuple(max(v[i] for v in vertices) for i in range(3))
    return tuple(b-a for a,b in zip(lower,upper))
