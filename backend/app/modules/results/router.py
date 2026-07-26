import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.core.response import success_response
from app.modules.exams.repository import ExamSubjectRow
from app.modules.results import service
from app.modules.results.schemas import RejectResultsRequest, SaveMarksRequest

router = APIRouter(prefix="/results", tags=["results"])


def _pending_mark_summary(row: ExamSubjectRow) -> dict:
    exam_subject, exam, class_entity, subject, _teacher, _teacher_user = row
    now = datetime.now(timezone.utc)
    deadline = exam_subject.marks_deadline
    deadline_aware = deadline if deadline.tzinfo is not None else deadline.replace(tzinfo=timezone.utc)
    return {
        "exam_subject_id": str(exam_subject.id),
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "class_name": class_entity.name,
        "subject_name": subject.name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "marks_deadline": exam_subject.marks_deadline.isoformat(),
        "marks_submitted_at": exam_subject.marks_submitted_at.isoformat() if exam_subject.marks_submitted_at else None,
        "is_overdue": exam_subject.marks_submitted_at is None and now > deadline_aware,
    }


# --- Teacher: marks entry -----------------------------------------------------


@router.get("/exam-subjects/my-pending", dependencies=[Depends(require_permission("results.enter"))])
async def list_my_pending_marks(
    current_user: CurrentUser = Depends(require_permission("results.enter")),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await service.list_my_pending_marks(db, current_user)
    return success_response(data=[_pending_mark_summary(row) for row in rows], message="Your marks entry assignments")


@router.get("/exam-subjects/{exam_subject_id}/roster", dependencies=[Depends(require_permission("results.enter"))])
async def get_marks_roster(
    exam_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.enter")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_marks_roster(db, current_user, exam_subject_id)
    return success_response(data=data, message="Marks roster retrieved")


@router.post("/exam-subjects/{exam_subject_id}/marks", dependencies=[Depends(require_permission("results.enter"))])
async def save_marks(
    exam_subject_id: uuid.UUID,
    payload: SaveMarksRequest,
    current_user: CurrentUser = Depends(require_permission("results.enter")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.save_marks(db, current_user, exam_subject_id, payload)
    return success_response(data=data, message="Marks saved")


@router.post("/exam-subjects/{exam_subject_id}/submit", dependencies=[Depends(require_permission("results.enter"))])
async def submit_marks(
    exam_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.enter")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.submit_marks(db, current_user, exam_subject_id)
    return success_response(data=data, message="Marks submitted")


# --- Admin: compilation & submission for Principal approval --------------------


@router.get("/exams/{exam_id}/compilation-status", dependencies=[Depends(require_permission("results.compile"))])
async def get_compilation_status(exam_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    data = await service.get_compilation_status(db, exam_id)
    return success_response(data=data, message="Compilation status retrieved")


@router.post("/exams/{exam_id}/compile", dependencies=[Depends(require_permission("results.compile"))])
async def compile_and_submit(
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.compile")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.compile_and_submit(db, current_user, exam_id)
    return success_response(data=data, message="Results compiled and submitted for Principal approval")


# --- Principal: approve / reject / publish -------------------------------------


@router.get("/exams/pending-approval", dependencies=[Depends(require_permission("results.approve"))])
async def list_pending_approval(db: AsyncSession = Depends(get_db_session)):
    data = await service.list_pending_approval(db)
    return success_response(data=data, message="Exams pending Principal approval")


@router.post("/exams/{exam_id}/approve", dependencies=[Depends(require_permission("results.approve"))])
async def approve_results(
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.approve_results(db, current_user, exam_id)
    return success_response(data=data, message="Results approved")


@router.post("/exams/{exam_id}/reject", dependencies=[Depends(require_permission("results.approve"))])
async def reject_results(
    exam_id: uuid.UUID,
    payload: RejectResultsRequest,
    current_user: CurrentUser = Depends(require_permission("results.approve")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.reject_results(db, current_user, exam_id, payload)
    return success_response(data=data, message="Results sent back for revision")


@router.post("/exams/{exam_id}/publish", dependencies=[Depends(require_permission("results.publish"))])
async def publish_results(
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.publish")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.publish_results(db, current_user, exam_id)
    return success_response(data=data, message="Results published — now visible to students and guardians")


# --- Result cards & report cards (published data only) -------------------------


@router.get("/my/exams/{exam_id}/card", dependencies=[Depends(require_permission("results.view"))])
async def get_my_exam_card(
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_my_exam_card(db, current_user, exam_id)
    return success_response(data=data, message="Exam result card retrieved")


@router.get("/my/report-card", dependencies=[Depends(require_permission("results.view"))])
async def get_my_report_card(
    academic_year_id: uuid.UUID | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_my_report_card(db, current_user, academic_year_id)
    return success_response(data=data, message="Report card retrieved")


@router.get("/students/{student_id}/exams/{exam_id}/card", dependencies=[Depends(require_permission("results.view"))])
async def get_student_exam_card(
    student_id: uuid.UUID,
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_exam_card(db, current_user, student_id, exam_id)
    return success_response(data=data, message="Exam result card retrieved")


@router.get("/students/{student_id}/report-card", dependencies=[Depends(require_permission("results.view"))])
async def get_student_report_card(
    student_id: uuid.UUID,
    academic_year_id: uuid.UUID | None = Query(default=None),
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_report_card(db, current_user, student_id, academic_year_id)
    return success_response(data=data, message="Report card retrieved")


# --- AI-assisted result insight summaries (published data only) ----------------


@router.post("/insights/exam-subjects/{exam_subject_id}", dependencies=[Depends(require_permission("results.view"))])
async def get_subject_insight(
    exam_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_subject_insight(db, current_user, exam_subject_id)
    return success_response(data=data, message="Insight summary generated")


@router.post(
    "/insights/exams/{exam_id}/classes/{class_id}", dependencies=[Depends(require_permission("results.view"))]
)
async def get_class_insight(
    exam_id: uuid.UUID,
    class_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_class_insight(db, current_user, exam_id, class_id)
    return success_response(data=data, message="Insight summary generated")


@router.post("/insights/my/exams/{exam_id}", dependencies=[Depends(require_permission("results.view"))])
async def get_my_individual_insight(
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_my_individual_insight(db, current_user, exam_id)
    return success_response(data=data, message="Insight summary generated")


@router.post(
    "/insights/students/{student_id}/exams/{exam_id}", dependencies=[Depends(require_permission("results.view"))]
)
async def get_student_individual_insight(
    student_id: uuid.UUID,
    exam_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("results.view")),
    db: AsyncSession = Depends(get_db_session),
):
    data = await service.get_student_individual_insight(db, current_user, student_id, exam_id)
    return success_response(data=data, message="Insight summary generated")
