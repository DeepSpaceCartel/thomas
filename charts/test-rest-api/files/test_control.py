"""Deliberate, non-production test-control endpoints - see
../../../features/rest/health-{short,full}.feature's readiness-flip
scenario.
"""

from fastapi import APIRouter

import health

router = APIRouter(prefix="/_test", tags=["test-control"])


@router.put("/ready")
def set_ready(ready: bool) -> dict:
    # The only way to make readiness (vs. liveness) failure actually
    # observable end to end: a real k8s readiness failure removes the Pod
    # from Service endpoints without restarting it, which a BDD scenario
    # can only witness for real if something can flip readiness false on
    # demand. `ready` is a query param (not a JSON body field)
    # specifically so a plain `true`/`false` string round-trips through
    # FastAPI's own query-bool coercion correctly - this framework's HTTP
    # request table always sends body FIELD values as strings, which
    # would otherwise need real JSON boolean typing this app doesn't need
    # to support yet.
    health.state["ready"] = ready
    return {"ready": health.state["ready"]}
