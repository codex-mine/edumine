from datetime import datetime

from pydantic import BaseModel


class PendingStudentSummary(BaseModel):
    id: str
    full_name: str
    email: str | None
    phone: str
    admission_number: str
    created_at: datetime
