"""Kubernetes health-probe endpoints - see ../../../features/rest/health.feature."""

import asyncio

from fastapi import APIRouter, Response

router = APIRouter(prefix="/health", tags=["health"])

# In-memory only, deliberately - disposable test fixture, not something
# that needs to survive a pod restart (same reasoning as notes.py's
# in-memory store). Also mutated by /_test/ready (test_control.py) - see
# that module for why readiness needs an external trigger.
state = {"started": False, "ready": True}


async def mark_started_after_delay() -> None:
    # Makes /health/startup genuinely false-then-true instead of trivially
    # always 200 - lets a scenario actually observe the startupProbe
    # blocking readiness/liveness checks until this really completes.
    await asyncio.sleep(5)
    state["started"] = True


@router.get("/startup")
def health_startup(response: Response) -> dict:
    if not state["started"]:
        response.status_code = 503
    return {"started": state["started"]}


@router.get("/ready")
def health_ready(response: Response) -> dict:
    if not state["ready"]:
        response.status_code = 503
    return {"ready": state["ready"]}


@router.get("/live")
def health_live() -> dict:
    # Always healthy in Phase 1 - no state exists yet whose corruption
    # would represent a genuine, restart-worthy deadlock.
    return {"live": True}
