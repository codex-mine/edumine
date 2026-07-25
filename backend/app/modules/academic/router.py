import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dependencies import CurrentUser, get_db_session, require_permission
from app.core.response import success_response
from app.modules.academic import service
from app.modules.academic.schemas import (
    AcademicYearResponse,
    ClassResponse,
    ClassSubjectResponse,
    CreateAcademicYearRequest,
    CreateClassRequest,
    CreateClassSubjectRequest,
    CreateRoomRequest,
    CreateSectionRequest,
    CreateSubjectRequest,
    EnrollmentResponse,
    EnrollStudentRequest,
    PromoteStudentsRequest,
    PromoteStudentsResponse,
    RoomResponse,
    SectionResponse,
    SubjectResponse,
    UpdateClassRequest,
    UpdateClassSubjectRequest,
    UpdateEnrollmentRequest,
    UpdateRoomRequest,
    UpdateSectionRequest,
    UpdateSubjectRequest,
)

router = APIRouter(prefix="/academic", tags=["academic"])


def _year_response(year) -> dict:
    return AcademicYearResponse(
        id=str(year.id),
        name=year.name,
        start_date=year.start_date,
        end_date=year.end_date,
        is_active=year.is_active,
        cloned_from_year_id=str(year.cloned_from_year_id) if year.cloned_from_year_id else None,
        created_at=year.created_at,
    ).model_dump(mode="json")


def _class_response(entity) -> dict:
    return ClassResponse(
        id=str(entity.id), name=entity.name, numeric_order=entity.numeric_order, created_at=entity.created_at
    ).model_dump(mode="json")


def _room_response(entity) -> dict:
    return RoomResponse(
        id=str(entity.id), name=entity.name, capacity=entity.capacity, created_at=entity.created_at
    ).model_dump(mode="json")


def _subject_response(entity) -> dict:
    return SubjectResponse(
        id=str(entity.id), name=entity.name, code=entity.code, created_at=entity.created_at
    ).model_dump(mode="json")


def _section_response(record, enrolled_count: int = 0) -> dict:
    section, class_entity, room, teacher, teacher_user = record
    return SectionResponse(
        id=str(section.id),
        academic_year_id=str(section.academic_year_id),
        class_id=str(section.class_id),
        class_name=class_entity.name,
        room_id=str(room.id) if room else None,
        room_name=room.name if room else None,
        name=section.name,
        capacity=section.capacity,
        enrolled_count=enrolled_count,
        class_teacher_id=str(teacher.id) if teacher else None,
        class_teacher_name=teacher_user.full_name if teacher_user else None,
        created_at=section.created_at,
    ).model_dump(mode="json")


def _class_subject_response(record) -> dict:
    class_subject, class_entity, subject, teacher, teacher_user = record
    return ClassSubjectResponse(
        id=str(class_subject.id),
        academic_year_id=str(class_subject.academic_year_id),
        class_id=str(class_subject.class_id),
        class_name=class_entity.name,
        subject_id=str(class_subject.subject_id),
        subject_name=subject.name,
        subject_code=subject.code,
        teacher_id=str(teacher.id) if teacher else None,
        teacher_name=teacher_user.full_name if teacher_user else None,
        full_marks=class_subject.full_marks,
        created_at=class_subject.created_at,
    ).model_dump(mode="json")


def _enrollment_response(record) -> dict:
    enrollment, student, user, academic_year, section, class_entity = record
    return EnrollmentResponse(
        id=str(enrollment.id),
        student_id=str(student.id),
        student_name=user.full_name,
        admission_number=student.admission_number,
        academic_year_id=str(academic_year.id),
        academic_year_name=academic_year.name,
        section_id=str(section.id),
        section_name=section.name,
        class_id=str(class_entity.id),
        class_name=class_entity.name,
        roll_number=enrollment.roll_number,
        status=enrollment.status,
        created_at=enrollment.created_at,
    ).model_dump(mode="json")


# --- Academic Years -------------------------------------------------------


@router.post("/years", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_academic_year(
    payload: CreateAcademicYearRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    year = await service.create_academic_year(db, current_user, payload)
    return success_response(data=_year_response(year), message="Academic year created", status_code=201)


@router.get("/years", dependencies=[Depends(require_permission("academic.view"))])
async def list_academic_years(db: AsyncSession = Depends(get_db_session)):
    years = await service.list_academic_years(db)
    return success_response(data=[_year_response(y) for y in years], message="Academic years retrieved")


@router.get("/years/active", dependencies=[Depends(require_permission("academic.view"))])
async def get_active_academic_year(db: AsyncSession = Depends(get_db_session)):
    year = await service.get_active_academic_year(db)
    return success_response(data=_year_response(year), message="Active academic year retrieved")


@router.get("/years/{year_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_academic_year(year_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    year = await service.get_academic_year(db, year_id)
    return success_response(data=_year_response(year), message="Academic year retrieved")


@router.post("/years/{year_id}/activate", dependencies=[Depends(require_permission("academic.manage"))])
async def activate_academic_year(
    year_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    year = await service.activate_academic_year(db, current_user, year_id)
    return success_response(data=_year_response(year), message="Academic year activated")


# --- Classes ----------------------------------------------------------------


@router.post("/classes", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_class(
    payload: CreateClassRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_class(db, current_user, payload)
    return success_response(data=_class_response(entity), message="Class created", status_code=201)


@router.get("/classes", dependencies=[Depends(require_permission("academic.view"))])
async def list_classes(search: str | None = Query(default=None, max_length=255), db: AsyncSession = Depends(get_db_session)):
    entities = await service.list_classes(db, search=search)
    return success_response(data=[_class_response(e) for e in entities], message="Classes retrieved")


@router.get("/classes/{class_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_class(class_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    entity = await service.get_class(db, class_id)
    return success_response(data=_class_response(entity), message="Class retrieved")


@router.patch("/classes/{class_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_class(
    class_id: uuid.UUID,
    payload: UpdateClassRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.update_class(db, current_user, class_id, payload)
    return success_response(data=_class_response(entity), message="Class updated")


@router.delete("/classes/{class_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def delete_class(
    class_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_class(db, current_user, class_id)
    return success_response(data=None, message="Class deleted")


# --- Rooms --------------------------------------------------------------


@router.post("/rooms", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_room(
    payload: CreateRoomRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_room(db, current_user, payload)
    return success_response(data=_room_response(entity), message="Room created", status_code=201)


@router.get("/rooms", dependencies=[Depends(require_permission("academic.view"))])
async def list_rooms(search: str | None = Query(default=None, max_length=255), db: AsyncSession = Depends(get_db_session)):
    entities = await service.list_rooms(db, search=search)
    return success_response(data=[_room_response(e) for e in entities], message="Rooms retrieved")


@router.get("/rooms/{room_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_room(room_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    entity = await service.get_room(db, room_id)
    return success_response(data=_room_response(entity), message="Room retrieved")


@router.patch("/rooms/{room_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_room(
    room_id: uuid.UUID,
    payload: UpdateRoomRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.update_room(db, current_user, room_id, payload)
    return success_response(data=_room_response(entity), message="Room updated")


@router.delete("/rooms/{room_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def delete_room(
    room_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_room(db, current_user, room_id)
    return success_response(data=None, message="Room deleted")


# --- Subjects -----------------------------------------------------------


@router.post("/subjects", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_subject(
    payload: CreateSubjectRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_subject(db, current_user, payload)
    return success_response(data=_subject_response(entity), message="Subject created", status_code=201)


@router.get("/subjects", dependencies=[Depends(require_permission("academic.view"))])
async def list_subjects(search: str | None = Query(default=None, max_length=255), db: AsyncSession = Depends(get_db_session)):
    entities = await service.list_subjects(db, search=search)
    return success_response(data=[_subject_response(e) for e in entities], message="Subjects retrieved")


@router.get("/subjects/{subject_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_subject(subject_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    entity = await service.get_subject(db, subject_id)
    return success_response(data=_subject_response(entity), message="Subject retrieved")


@router.patch("/subjects/{subject_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_subject(
    subject_id: uuid.UUID,
    payload: UpdateSubjectRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.update_subject(db, current_user, subject_id, payload)
    return success_response(data=_subject_response(entity), message="Subject updated")


@router.delete("/subjects/{subject_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def delete_subject(
    subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_subject(db, current_user, subject_id)
    return success_response(data=None, message="Subject deleted")


# --- Sections -----------------------------------------------------------


@router.post("/sections", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_section(
    payload: CreateSectionRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    entity = await service.create_section(db, current_user, payload)
    record = await service.get_section(db, entity.id)
    return success_response(data=_section_response(record), message="Section created", status_code=201)


@router.get("/sections", dependencies=[Depends(require_permission("academic.view"))])
async def list_sections(
    academic_year_id: uuid.UUID | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.list_sections(db, academic_year_id=academic_year_id, class_id=class_id)
    counts = await service.get_section_enrolled_counts(db, [r[0].id for r in records])
    return success_response(
        data=[_section_response(r, counts.get(r[0].id, 0)) for r in records], message="Sections retrieved"
    )


@router.get("/sections/{section_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_section(section_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_section(db, section_id)
    counts = await service.get_section_enrolled_counts(db, [record[0].id])
    return success_response(data=_section_response(record, counts.get(record[0].id, 0)), message="Section retrieved")


@router.patch("/sections/{section_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_section(
    section_id: uuid.UUID,
    payload: UpdateSectionRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_section(db, current_user, section_id, payload)
    counts = await service.get_section_enrolled_counts(db, [record[0].id])
    return success_response(data=_section_response(record, counts.get(record[0].id, 0)), message="Section updated")


@router.delete("/sections/{section_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def delete_section(
    section_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.soft_delete_section(db, current_user, section_id)
    return success_response(data=None, message="Section deleted")


# --- Class-Subject-Teacher assignment ------------------------------------


@router.post("/class-subjects", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def create_class_subject(
    payload: CreateClassSubjectRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.create_class_subject(db, current_user, payload)
    return success_response(data=_class_subject_response(record), message="Subject assigned to class", status_code=201)


@router.get("/class-subjects", dependencies=[Depends(require_permission("academic.view"))])
async def list_class_subjects(
    academic_year_id: uuid.UUID | None = Query(default=None),
    class_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.list_class_subjects(db, academic_year_id=academic_year_id, class_id=class_id)
    return success_response(data=[_class_subject_response(r) for r in records], message="Class-subject assignments retrieved")


@router.patch("/class-subjects/{class_subject_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_class_subject(
    class_subject_id: uuid.UUID,
    payload: UpdateClassSubjectRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_class_subject(db, current_user, class_subject_id, payload)
    return success_response(data=_class_subject_response(record), message="Class-subject assignment updated")


@router.delete("/class-subjects/{class_subject_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def delete_class_subject(
    class_subject_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    await service.delete_class_subject(db, current_user, class_subject_id)
    return success_response(data=None, message="Class-subject assignment removed")


# --- Student Enrollment / Promotion ----------------------------------------


@router.post("/enrollments", dependencies=[Depends(require_permission("academic.manage"))], status_code=201)
async def enroll_student(
    payload: EnrollStudentRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.enroll_student(db, current_user, payload)
    return success_response(data=_enrollment_response(record), message="Student enrolled", status_code=201)


@router.post("/enrollments/promote", dependencies=[Depends(require_permission("academic.manage"))])
async def promote_students(
    payload: PromoteStudentsRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    results = await service.promote_students(db, current_user, payload)
    return success_response(
        data=PromoteStudentsResponse(results=results).model_dump(mode="json"),
        message="Promotion processed",
    )


@router.get("/enrollments", dependencies=[Depends(require_permission("academic.view"))])
async def list_enrollments(
    academic_year_id: uuid.UUID | None = Query(default=None),
    section_id: uuid.UUID | None = Query(default=None),
    student_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
):
    records = await service.list_enrollments(
        db, academic_year_id=academic_year_id, section_id=section_id, student_id=student_id
    )
    return success_response(data=[_enrollment_response(r) for r in records], message="Enrollments retrieved")


@router.get("/enrollments/{enrollment_id}", dependencies=[Depends(require_permission("academic.view"))])
async def get_enrollment(enrollment_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)):
    record = await service.get_enrollment(db, enrollment_id)
    return success_response(data=_enrollment_response(record), message="Enrollment retrieved")


@router.patch("/enrollments/{enrollment_id}", dependencies=[Depends(require_permission("academic.manage"))])
async def update_enrollment(
    enrollment_id: uuid.UUID,
    payload: UpdateEnrollmentRequest,
    current_user: CurrentUser = Depends(require_permission("academic.manage")),
    db: AsyncSession = Depends(get_db_session),
):
    record = await service.update_enrollment(db, current_user, enrollment_id, payload)
    return success_response(data=_enrollment_response(record), message="Enrollment updated")
