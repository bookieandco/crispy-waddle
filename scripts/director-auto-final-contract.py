#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = {
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-autopilot-worker.ts": [
        "runSideHustleDirectorAutopilotWorker",
        "advanceSideHustleDirectorPostExecution",
        "canApproveCreative:false",
        "canPublish:false",
        "canSpendPaidMedia:false",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-take-runtime.ts": [
        "submitSideHustleDirectorTakeBatch",
        "maxBoards??1",
        "preserveAfterSelection:true",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-take-reconciler.ts": [
        "reconcileSideHustleDirectorTakeSets",
        "director-watch-vlm:v1",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-post-work-session.ts": [
        "director.audio.voice",
        "director.audio.music",
        "director.audio.foley",
        "director.video.lip-sync",
        "director.audio.mix",
        "director.render.final",
        "director.qc.final-watch",
        "canExecute:false",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-post-executor.ts": [
        "CANONICAL_COMPUTE_SUBMISSION",
        "COMPUTE_RUNTIME_BINDING_REQUIRED",
        "canSpend:false",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-post-result.ts": [
        "DIRECTOR_POST_RESULT_RECONCILIATION",
        "director_project_final_qc_evidence",
        "canApprove:false",
        "canPublish:false",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-final-qc.ts": [
        "evaluateSideHustleDirectorFinalQcReadiness",
        "director_project_final_qc_receipts",
    ],
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-canary.ts": [
        "productionReadyForSocialProposal",
        "SOCIAL_PUBLICATION_APPROVAL",
        "canGenerate:false",
        "canApprove:false",
        "canPublish:false",
        "canSpend:false",
    ],
    "apps/jhadina-web/src/app/api/workstation/social-proposal/route.ts": [
        "DIRECTOR_SOCIAL_FINAL_QC_ADMISSION_REQUIRED",
        "DIRECTOR_SOCIAL_FINAL_MASTER_REQUIRED",
        "publicationAuthority:'APPROVAL_REQUIRED'",
        "paidMediaAuthority:'NONE'",
    ],
    "apps/jhadina-web/src/lib/director-idle-watch-worker.ts": [
        "JHADINA_COMPUTE_BUSY",
        "DIRECTOR_RENDER_ACTIVE",
        "BACKGROUND_OBSERVATION_ONLY",
        "canWager:false",
        "canSpend:false",
    ],
    "apps/jhadina-web/src/app/api/director/watch-jobs/commissioning/route.ts": [
        "DIRECTOR_WATCH_COMMISSION_REAL_TAKE_REQUIRED",
        "WAIT_FOR_AUTHENTICATED_WATCH_CALLBACK_RECEIPTS",
        "commissionedNow:false",
    ],
    "services/director-watch-worker/handler.py": [
        'purpose == "take-qc"',
        "take_qc_temporal_prompt",
        "Do not approve publication",
    ],
    "services/director-watch-worker/homebase_handler.py": [
        "DIRECTOR_WATCH_HOMEBASE_RTSP_HOST_NOT_ALLOWED",
        "DIRECTOR_WATCH_HOMEBASE_LOCAL_FILE_OUTSIDE_MEDIA_ROOT",
        "DIRECTOR_WATCH_HOMEBASE_CAPTURE_ALIAS_NOT_FOUND",
        "OWNER_CONFIGURED_HOMEBASE_SOURCE",
    ],
    "services/director-watch-worker/homebase_server.py": [
        "DIRECTOR_WATCH_HOMEBASE_NOT_PRODUCTION_READY",
        "DIRECTOR_WATCH_HOMEBASE_QUEUE_FULL",
        "hmac.compare_digest",
        "edge_detector_health",
        "perceptionMode",
    ],
    "services/director-watch-worker/edge_prefilter.py": [
        "DIRECTOR_WATCH_EDGE_DETECTOR_LICENSE_APPROVED",
        "DIRECTOR_WATCH_EDGE_ULTRALYTICS_LICENSE_APPROVAL_REQUIRED",
        "DIRECTOR_WATCH_EDGE_DETECTOR_HTTP_ALLOWLIST",
        "EDGE_PREFILTER_ONLY",
        "canEstablishReality",
    ],
    "services/director-edge-vision-worker/server.py": [
        "DIRECTOR_EDGE_VISION_MODEL_LICENSE",
        "DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED",
        "DIRECTOR_EDGE_VISION_PRODUCTION_READY",
        '"authority": "OBSERVATION_ONLY"',
        '"canEstablishIdentity": False',
        '"canEstablishSportsReality": False',
        '"canWager": False',
    ],
    "apps/jhadina-web/src/lib/director-cvat-annotation-provider.ts": [
        "directorCvatRuntimeHealth",
        "GROUND_TRUTH_CANDIDATE_ONLY",
        "accepted:false",
    ],
    "apps/jhadina-web/src/lib/director-cvat-annotation-service.ts": [
        "reviewDirectorCvatAnnotationImport",
        "accepted:input.decision==='accepted'",
        "canEstablishSportsReality:false",
    ],
    "apps/jhadina-web/src/app/api/director/annotations/route.ts": [
        "DIRECTOR_CVAT_SOURCE_AUTHORIZATION_REQUIRED",
        "requireDirectorProjectAuthority",
        "reviewDirectorCvatAnnotationImport",
    ],
    "apps/jhadina-web/components/workstation/WorkstationAnnotationReview.tsx": [
        "CVAT annotation review",
        "Accept evidence",
        "candidate evidence",
    ],
    ".github/workflows/director-background-supervisor.yml": [
        "jhadina-director-background",
        "/api/internal/director/production-autopilot",
        "/api/internal/director/idle-watch",
    ],
}

FORBIDDEN = {
    "apps/jhadina-web/src/lib/opportunities/side-hustle-director-post-executor.ts": [
        "allowCloudBurst:true",
    ],
    "apps/jhadina-web/src/lib/director-idle-watch-worker.ts": [
        "canWager:true",
        "canSpend:true",
    ],
    "apps/jhadina-web/src/app/api/workstation/social-proposal/route.ts": [
        "publicationAuthority:'AUTO'",
        "paidMediaAuthority:'AUTO'",
    ],
    "services/director-edge-vision-worker/server.py": [
        "from ultralytics",
        "import ultralytics",
        "YOLO(",
        '"canEstablishSportsReality": True',
        '"canWager": True',
    ],
    "apps/jhadina-web/src/lib/director-cvat-annotation-service.ts": [
        "canEstablishSportsReality:true",
    ],
}

def main() -> None:
    failures: list[str] = []
    for rel, needles in REQUIRED.items():
        path = ROOT / rel
        if not path.exists():
            failures.append(f"missing file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for needle in needles:
            if needle not in text:
                failures.append(f"{rel}: missing required contract token: {needle}")
    for rel, needles in FORBIDDEN.items():
        path = ROOT / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for needle in needles:
            if needle in text:
                failures.append(f"{rel}: forbidden authority token present: {needle}")
    if failures:
        raise SystemExit("\n".join(failures))
    print("DIRECTOR-AUTO.FINAL source contract PASS")

if __name__ == "__main__":
    main()
