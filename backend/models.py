from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    team_name: Optional[str] = None

class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    full_name: str
    team_id: Optional[str] = None
    role: str = "member"  # admin, member, viewer
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# Team Models
class Team(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    owner_id: str
    member_ids: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

# Dataset Models
class DatasetCreate(BaseModel):
    name: str
    file_data: str  # base64 encoded file
    file_type: str  # csv or xlsx

class Dataset(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    columns: List[Dict[str, Any]]  # [{name, type, sample_values}]
    row_count: int
    data: List[Dict[str, Any]]  # Actual data rows
    owner_id: str
    team_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    file_type: str
    
    class Config:
        populate_by_name = True

# Chart Models
class ChartConfig(BaseModel):
    chart_type: str  # bar, line, pie, scatter, area, heatmap, gauge, funnel, table
    dataset_id: str
    x_axis: Optional[str] = None
    y_axis: Optional[List[str]] = None
    group_by: Optional[str] = None
    aggregation: str = "sum"  # sum, avg, count, min, max
    filters: Dict[str, Any] = {}
    colors: List[str] = []
    title: str = ""
    show_legend: bool = True
    show_labels: bool = True

class Chart(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    config: ChartConfig
    owner_id: str
    team_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

# Dashboard Models
class DashboardLayout(BaseModel):
    chart_id: str
    x: int = 0
    y: int = 0
    width: int = 6
    height: int = 4

class Dashboard(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = ""
    charts: List[DashboardLayout] = []
    filters: Dict[str, Any] = {}
    owner_id: str
    team_id: Optional[str] = None
    shared_with: List[str] = []  # user_ids who have access
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

# AI Models
class ChartSuggestionRequest(BaseModel):
    dataset_id: str

class NaturalLanguageQuery(BaseModel):
    query: str
    dataset_id: str
    session_id: Optional[str] = None

class AnalyticsRequest(BaseModel):
    dataset_id: str
    column: str
    analysis_type: str  # trend, forecast, statistics