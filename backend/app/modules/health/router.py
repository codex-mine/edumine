from fastapi import APIRouter

from app.core.response import success_response

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    return success_response(data={"status": "ok"}, message="Service is healthy")
