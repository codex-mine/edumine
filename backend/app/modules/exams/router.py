import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.core.response import success_response
from app.modules.exams import service
from app.modules.exams.models import Exam
from app.modules.exams.repository import ExamSubjectRow
from app.modules.exams.schemas import (
    ConfigureExamSubjectsRequest,
    CreateExamRequest,
    DraftQuestionsRequest,
    ExtendDeadlineRequest,
    RequestExtensionRequest,
    SubmitQuestionsRequest,
)

router = APIRouter(prefix="/exams", tags=["exams"])


def _exam_response(exam: Exam, classes: list) -> dict:
    return {
        "id": str(exam.id),
        "academic_year_id": str(exam.academic_year_id),
        "name": exam.name,
        "term": exam.term,
        "start_date": exam.start_date.isoformat(),
        "end_date": exam.end_date.isoformat(),
        "status": exam.status.value,
        "created_by": str(exam.created_by),
        "created_at": exam.created_at.isoformat(),
        "classes": [{"class_id": str(c.id), "class_name": c.name} for c in classes],
    }


def _exam_subject_response(row: ExamSubjectRow, *, extension_requested: bool = False) -> dict:
    exam_subject, exam, class_entity, subject, teacher, teacher_user = row
    now = datetime.now(timezone.utc)
    deadline = exam_subject.question_deadline
    deadline_aware = deadline if deadline.tzinfo is not None else deadline.replace(tzinfo=timezone.utc)
    is_overdue = exam_subject.question_submitted_at is None and now > deadline_aware
    return {
        "id": str(exam_subject.id),
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "exam_status": exam.status.value,
        "class_id": str(class_entity.id),
        "class_name": class_entity.name,
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "teacher_id": str(teacher.id),
        "teacher_name": teacher_user.full_name,
        "full_marks": exam_subject.full_marks,
        "pass_marks": exam_subject.pass_marks,
        "question_deadline": exam_subject.question_deadline.isoformat(),
        "question_submitted_at": exam_subject.question_submitted_at.isoformat() if exam_subject.question_submitted_at else None,
        "marks_deadline": exam_subject.marks_deadline.isoformat(),
        "marks_submitted_at": exam_subject.marks_submitted_at.isoformat() if exam_subject.marks_submitted_at else None,
        "is_overdue": is_overdue,
        "extension_requested": extension_requested,
        "questions": exam_subject.questions_payload,
    }


# --- Exam creation & configuration (Admin) -----------------------------------


@router.post("", dependencies=[Depends(require_permission("exams.manage"))], status_code=201)
async def create_exam(
    payload: CreateExamRequest,
    current_user: CurrentUser = Depends(require_permission("exams.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    exam = await service.create_exam(db, current_user, payload)
    classes = await service.repository.list_exam_classes(db, exam.id)
    return success_response(data=_exam_response(exam, classes), message="Exam created", status_code=201)


@router.get("", dependencies=[Depends(require_permission("exams.view"))])
async def list_exams(
    academic_year_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    exams = await service.list_exams(db, academic_year_id=academic_year_id)
    data = []
    for exam in exams:
        classes = await service.repository.list_exam_classes(db, exam.id)
        data.append(_exam_response(exam, classes))
    return success_response(data=data, message="Exams retrieved")


@router.get("/{exam_id}", dependencies=[Depends(require_permission("exams.view"))])
async def get_exam(exam_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    exam = await service.get_exam_or_404(db, exam_id)
    classes = await service.repository.list_exam_classes(db, exam.id)
    subjects = await service.repository.list_exam_subjects_for_exam(db, exam.id)
    data = _exam_response(exam, classes)
    data["subjects"] = [_exam_subject_response(row) for row in subjects]
    return success_response(data=data, message="Exam retrieved")


@router.get("/{exam_id}/candidate-subjects", dependencies=[Depends(require_permission("exams.manage"))])
async def list_candidate_subjects(exam_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    candidates = await service.list_candidate_subjects(db, exam_id)
    return success_response(data=candidates, message="Candidate subjects retrieved")


@router.post("/{exam_id}/subjects", dependencies=[Depends(require_permission("exams.manage"))])
async def configure_exam_subjects(
    exam_id: uuid.UUID,
    payload: ConfigureExamSubjectsRequest,
    current_user: CurrentUser = Depends(require_permission("exams.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await service.configure_exam_subjects(db, current_user, exam_id, payload)
    return success_response(
        data=[_exam_subject_response(row) for row in rows],
        message="Exam subjects configured and assigned teachers notified",
    )


# --- Deadline extension requests (Admin queue) --------------------------------


@router.get("/subjects/extension-requests", dependencies=[Depends(require_permission("exams.manage"))])
async def list_extension_requests(db: AsyncSession = Depends(get_db_session)):
    requests = await service.list_extension_requests(db)
    data = [
        {
            **item,
            "current_deadline": item["current_deadline"].isoformat(),
            "requested_at": item["requested_at"].isoformat(),
        }
        for item in requests
    ]
    return success_response(data=data, message="Pending deadline extension requests retrieved")


@router.patch("/subjects/{exam_subject_id}/extend-deadline", dependencies=[Depends(require_permission("exams.manage"))])
async def extend_deadline(
    exam_subject_id: uuid.UUID,
    payload: ExtendDeadlineRequest,
    current_user: CurrentUser = Depends(require_permission("exams.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    row = await service.extend_deadline(db, current_user, exam_subject_id, payload)
    return success_response(data=_exam_subject_response(row), message="Question deadline extended")


# --- Teacher-facing question submission --------------------------------------


@router.get("/subjects/my-submissions", dependencies=[Depends(require_permission("exams.view"))])
async def list_my_submissions(
    current_user: CurrentUser = Depends(require_permission("exams.view")),
    db: AsyncSession = Depends(get_db_session),
):
    rows = await service.list_my_pending_submissions(db, current_user)
    pending_requests = await service.list_extension_requests(db)
    pending_ids = {item["exam_subject_id"] for item in pending_requests}
    data = [
        _exam_subject_response(row, extension_requested=str(row[0].id) in pending_ids) for row in rows
    ]
    return success_response(data=data, message="Your exam question submissions")


@router.post("/subjects/{exam_subject_id}/submit", dependencies=[Depends(require_permission("exams.submit_questions"))])
async def submit_questions(
    exam_subject_id: uuid.UUID,
    payload: SubmitQuestionsRequest,
    current_user: CurrentUser = Depends(require_permission("exams.submit_questions")),
    db: AsyncSession = Depends(get_db_session),
):
    row = await service.submit_questions(db, current_user, exam_subject_id, payload)
    return success_response(data=_exam_subject_response(row), message="Questions submitted")


@router.post(
    "/subjects/{exam_subject_id}/request-extension",
    dependencies=[Depends(require_permission("exams.submit_questions"))],
)
async def request_extension(
    exam_subject_id: uuid.UUID,
    payload: RequestExtensionRequest,
    current_user: CurrentUser = Depends(require_permission("exams.submit_questions")),
    db: AsyncSession = Depends(get_db_session),
):
    row = await service.request_extension(db, current_user, exam_subject_id, payload)
    return success_response(data=_exam_subject_response(row), message="Deadline extension request sent to admin")


@router.post(
    "/subjects/{exam_subject_id}/draft-questions",
    dependencies=[Depends(require_permission("exams.submit_questions"))],
)
async def draft_questions(
    exam_subject_id: uuid.UUID,
    payload: DraftQuestionsRequest,
    current_user: CurrentUser = Depends(require_permission("exams.submit_questions")),
    db: AsyncSession = Depends(get_db_session),
):
    draft = await service.draft_questions(db, current_user, exam_subject_id, payload)
    return success_response(data=draft, message="Draft ready for your review — edit and submit explicitly")
