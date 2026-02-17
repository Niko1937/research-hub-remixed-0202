"""
Pydantic Models / Schemas
"""

from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Chat message"""
    role: Literal["user", "assistant", "system"]
    content: str


class ResearchChatRequest(BaseModel):
    """Research chat request"""
    messages: list[ChatMessage]
    mode: Literal["search", "assistant"] = "assistant"
    tool: Optional[str] = None
    toolQuery: Optional[str] = None
    pdfContext: Optional[str] = None
    highlightedText: Optional[str] = None
    screenshot: Optional[str] = None
    deepDiveContext: Optional[dict] = None
    researchIdFilter: Optional[str] = None  # 研究IDでフィルタリング（初回からoipf-detailsを検索）


class Step(BaseModel):
    """Execution step"""
    tool: str
    query: str
    description: str


class ExternalPaper(BaseModel):
    """External paper"""
    id: Optional[int] = None
    title: str
    abstract: str
    authors: list[str]
    year: str
    source: str
    url: str
    citations: Optional[int] = None


class InternalResearch(BaseModel):
    """Internal research"""
    title: str
    tags: list[str]
    similarity: float
    year: str


class BusinessChallenge(BaseModel):
    """Business challenge"""
    challenge: str
    business_unit: str
    priority: str
    keywords: list[str]


class Expert(BaseModel):
    """Expert/employee"""
    employee_id: str
    name: str
    affiliation: str
    role: str
    mail: str
    approachability: Literal["direct", "introduction", "via_manager"]
    connectionPath: str
    distance: int


class PositioningAxis(BaseModel):
    """Positioning analysis axis"""
    name: str
    type: Literal["quantitative", "qualitative"] = "quantitative"


class PositioningItem(BaseModel):
    """Positioning analysis item"""
    name: str
    fullTitle: Optional[str] = None
    authors: Optional[str] = None
    source: Optional[str] = None
    type: Literal["internal", "external", "target"]
    values: dict[str, float]


class PositioningData(BaseModel):
    """Positioning analysis data"""
    axes: list[PositioningAxis]
    suggestedChartType: str = "scatter"
    items: list[PositioningItem]
    insights: list[str]


class SeedsNeedsCandidate(BaseModel):
    """Seeds-needs matching candidate"""
    title: str
    description: Optional[str] = None
    department: str
    evaluation: Literal["high", "medium", "low"]
    reason: Optional[str] = None
    score: int = 50


class SeedsNeedsData(BaseModel):
    """Seeds-needs matching data"""
    seedTitle: str
    seedDescription: str
    candidates: list[SeedsNeedsCandidate]
