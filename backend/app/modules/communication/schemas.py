import uuid

from pydantic import BaseModel, Field, model_validator

from app.common.enums import AudienceType


class CreateAnnouncementRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)
    audience_type: AudienceType
    section_id: uuid.UUID | None = None
    send_sms: bool = False
    sms_message: str | None = Field(default=None, max_length=480)

    @model_validator(mode="after")
    def _section_required_for_specific_class(self) -> "CreateAnnouncementRequest":
        if self.audience_type == AudienceType.specific_class and self.section_id is None:
            raise ValueError("section_id is required when audience_type is 'specific_class'")
        if self.audience_type != AudienceType.specific_class and self.section_id is not None:
            raise ValueError("section_id may only be set when audience_type is 'specific_class'")
        if self.send_sms and not self.sms_message:
            raise ValueError("sms_message is required when send_sms is true")
        return self


class DraftAnnouncementRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    audience_type: AudienceType
    details: str = Field(..., min_length=1, max_length=2000)
    tone: str = Field(default="informational", max_length=50)
    char_limit: int | None = Field(default=None, ge=20, le=480)
