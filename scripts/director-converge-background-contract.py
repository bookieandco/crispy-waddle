#!/usr/bin/env python3
"""Director .07 identity-and-execution-boundary source contract; no network or mutation."""
from pathlib import Path

root=Path(__file__).resolve().parents[1]
routes=(
    root/'apps/jhadina-web/src/app/api/internal/director/background-health/route.ts',
    root/'apps/jhadina-web/src/app/api/internal/director/production-autopilot/route.ts',
    root/'apps/jhadina-web/src/app/api/internal/director/idle-watch/route.ts',
)
for file in routes:
    source=file.read_text()
    assert 'authorizedDirectorBackgroundRequest' in source, file
    assert 'createRuntimeServiceRoleClient' in source, file
    assert 'await createRuntimeServiceRoleClient()' in source, file
    assert 'createSchedulerServiceRoleClient' not in source, file
    assert source.index('authorizedDirectorBackgroundRequest(request)') < source.index(
        'await createRuntimeServiceRoleClient()'), file

health=routes[0].read_text()
assert 'durableRecoveryCertified:false' in health
assert 'storageReady:true' in health and 'DIRECTOR_BACKGROUND_HEALTH_ONLY' in health
auth=(root/'apps/jhadina-web/src/lib/internal-scheduler-auth.ts').read_text()
assert "const DIRECTOR_BACKGROUND_AUDIENCE = 'jhadina-director-background'" in auth
assert 'director-background-supervisor.yml@refs/heads/main' in auth
proxy=(root/'supabase/functions/jhadina-service-proxy/index.ts').read_text()
assert 'jhadina-director-background' not in proxy, 'A Director GitHub token must never be a general Supabase identity'
workflow=(root/'.github/workflows/director-background-supervisor.yml').read_text()
assert ".durableRecoveryCertified" not in workflow or 'durable_certified=' in workflow
assert '"$durable_certified" == "true"' in workflow
assert "if: steps.health.outputs.ready == 'true'" in workflow
watch=(root/'apps/jhadina-web/src/lib/director-idle-watch-worker.ts').read_text()
for term in (".eq('rights_verified',true)",".eq('source_authorized',true)",
             "sourceKind:source.source_kind", "canPublish:false"):
    if term == "canPublish:false":
        continue
    assert term in watch, term
print("DIRECTOR_BACKGROUND_IDENTITY_SCOPE_CONTRACT_PASS")
