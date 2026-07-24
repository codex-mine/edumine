from datetime import time

from sqlalchemy import ForeignKey, Index, SmallInteger, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_model import TimestampMixin, UUIDPrimaryKeyMixin
from app.common.enums import Weekday, pg_enum
from app.db.base import Base


class RoutineSlot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "routine_slots"
    __table_args__ = (
        UniqueConstraint(
            "section_id", "day_of_week", "period_number", name="uq_routine_slots_section_day_period"
        ),
        UniqueConstraint(
            "teacher_id", "day_of_week", "period_number", name="uq_routine_slots_teacher_day_period"
        ),
        Index("ix_routine_slots_year_day", "academic_year_id", "day_of_week"),
    )

    academic_year_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    teacher_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    room_id: Mapped[UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=True)
    day_of_week: Mapped[Weekday] = mapped_column(pg_enum(Weekday, "weekday"), nullable=False)
    period_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
