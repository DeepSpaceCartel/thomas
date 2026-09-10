"""Thomas rest-api test fixture.

A real FastAPI app, not a stub - deployed via ../templates/deployment.yaml
(source mounted from a ConfigMap, dependencies installed at pod startup)
and exercised by Thomas's HTTP BDD steps. Phase 1 covered the 3 k8s
health-probe endpoints (health.py, test_control.py - see
../../../features/rest/health-{short,full}.feature); Phase 2 adds
/files and /notes CRUD (notes.py, files.py - see
../../../features/rest/notes-{short,full}.feature and
files-{short,full}.feature); auth (/users, /auth, /oauth) lands in
Phase 3 as more
.py files here (auto-picked up by ../templates/configmap.yaml's
Files.Glob, no chart change needed).
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

import files
import health
import notes
import oauth
import secure
import test_control
import users


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(health.mark_started_after_delay())
    yield
    task.cancel()


app = FastAPI(title="Thomas rest-api test fixture", lifespan=lifespan)
app.include_router(health.router)
app.include_router(test_control.router)
app.include_router(notes.router)
app.include_router(files.router)
app.include_router(users.router)
app.include_router(oauth.router)
app.include_router(secure.router)
