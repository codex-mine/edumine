from fastapi import APIRouter, Depends, UploadFile

from app.common.dependencies import CurrentUser, get_current_user
from app.core.response import success_response
from app.core.storage import save_upload_file

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("")
async def upload_file(
    file: UploadFile,
    current_user: CurrentUser = Depends(get_current_user),
):
    url = await save_upload_file(file)
    return success_response(data={"url": url, "filename": file.filename}, message="File uploaded successfully", status_code=201)
