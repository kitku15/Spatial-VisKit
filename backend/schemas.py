from pydantic import BaseModel, Field


class ExportFilter(BaseModel):
    column: str
    value: str


class ExportRequest(BaseModel):
    filters: list[ExportFilter]
    obs_columns: list[str]
    genes: list[str]
    lasso_cells: list[str] = Field(default_factory=list)


class GSEARequest(BaseModel):
    celltype: str
    comparison: str
    database: str
    min_size: int = 5
    max_size: int = 1000
    padj_threshold: float = 0.05
    nes_threshold: float = 1.0
