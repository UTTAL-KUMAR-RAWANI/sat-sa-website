from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import global_exception_handler
from app.api import auth, rbac
from app.admin import router as admin_router
from app.secops.router import router as secops_router
from app.findings.router import router as findings_router
from app.assessments.router import router as assessments_router
from app.risks.router import risks_router, treatments_router, exceptions_router
from app.remediations.router import router as remediations_router
from app.supervision.router import router as supervision_router
from app.datasets.router import datasets_router, analytics_router
from app.negative_space.router import negative_space_router
from app.executive.router import executive_router
from app.audit.router import audit_router
from app.notifications.router import notifications_router
from app.my_work.router import my_work_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(Exception, global_exception_handler)

# Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(rbac.router, prefix=f"{settings.API_V1_STR}/rbac", tags=["rbac"])
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(secops_router, prefix=f"{settings.API_V1_STR}", tags=["secops"])
app.include_router(findings_router, prefix=f"{settings.API_V1_STR}", tags=["findings"])
app.include_router(assessments_router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])
app.include_router(risks_router, prefix=f"{settings.API_V1_STR}", tags=["risks"])
app.include_router(treatments_router, prefix=f"{settings.API_V1_STR}", tags=["risk-treatments"])
app.include_router(exceptions_router, prefix=f"{settings.API_V1_STR}", tags=["risk-exceptions"])
app.include_router(remediations_router, prefix=f"{settings.API_V1_STR}", tags=["remediations"])
app.include_router(supervision_router, prefix=f"{settings.API_V1_STR}", tags=["supervision"])
app.include_router(datasets_router, prefix=f"{settings.API_V1_STR}", tags=["datasets"])
app.include_router(analytics_router, prefix=f"{settings.API_V1_STR}", tags=["analytics"])
app.include_router(negative_space_router, prefix=f"{settings.API_V1_STR}", tags=["negative-space"])
app.include_router(executive_router, prefix=f"{settings.API_V1_STR}", tags=["executive"])
app.include_router(audit_router, prefix=f"{settings.API_V1_STR}", tags=["audit-logs"])
app.include_router(notifications_router, prefix=f"{settings.API_V1_STR}", tags=["notifications"])
app.include_router(my_work_router, prefix=f"{settings.API_V1_STR}", tags=["my-work"])

@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
