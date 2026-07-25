from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


def pagination_meta(params: PaginationParams, total: int) -> dict[str, int]:
    return {"page": params.page, "limit": params.limit, "total": total}
