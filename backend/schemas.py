from pydantic import BaseModel, Field


class ExportFilter(BaseModel):
    column: str
    value: str


class ExportRequest(BaseModel):
    filters: list[ExportFilter]
    obs_columns: list[str]
    genes: list[str]
    lasso_cells: list[str] = Field(default_factory=list)
