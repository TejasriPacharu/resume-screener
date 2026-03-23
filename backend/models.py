from pydantic import BaseModel


class ResumeField(BaseModel):
    field_name: str
    field_extraction_description: str


class ResumeExtractionConfig(BaseModel):
    extract_fields: list[ResumeField]