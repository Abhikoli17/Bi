from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

# Import models and services
from models import *
from auth_service import hash_password, verify_password, create_access_token, verify_token
from data_service import parse_csv_data, parse_excel_data, aggregate_data
from ai_service import suggest_charts, natural_language_query
from analytics_service import calculate_trends, forecast_values, calculate_statistics

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="PowerBI Clone API")

# Create API router
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await db.users.find_one({"email": payload.get("email")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    return user

# ===== AUTH ENDPOINTS =====
@api_router.post("auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_pwd = hash_password(user_data.password)
    
    # Create team if team_name provided
    team_id = None
    if user_data.team_name:
        team_doc = {
            "name": user_data.team_name,
            "owner_id": "",  # Will update after user creation
            "member_ids": [],
            "created_at": datetime.utcnow()
        }
        team_result = await db.teams.insert_one(team_doc)
        team_id = str(team_result.inserted_id)
    
    # Create user
    user_doc = {
        "email": user_data.email,
        "password_hash": hashed_pwd,
        "full_name": user_data.full_name,
        "team_id": team_id,
        "role": "admin" if team_id else "member",
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Update team owner
    if team_id:
        await db.teams.update_one(
            {"_id": ObjectId(team_id)},
            {"$set": {"owner_id": user_id}, "$push": {"member_ids": user_id}}
        )
    
    # Create token
    token = create_access_token({"email": user_data.email, "user_id": user_id})
    
    user_obj = User(
        _id=user_id,
        email=user_data.email,
        full_name=user_data.full_name,
        team_id=team_id,
        role=user_doc["role"],
        created_at=user_doc["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_obj)

@api_router.post("auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    token = create_access_token({"email": user["email"], "user_id": user_id})
    
    user_obj = User(
        _id=user_id,
        email=user["email"],
        full_name=user["full_name"],
        team_id=user.get("team_id"),
        role=user.get("role", "member"),
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_obj)

@api_router.get("auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

# ===== DATASET ENDPOINTS =====
@api_router.post("/datasets", response_model=Dataset)
async def create_dataset(dataset_create: DatasetCreate, current_user: dict = Depends(get_current_user)):
    try:
        # Parse file based on type
        if dataset_create.file_type.lower() == "csv":
            parsed_data = parse_csv_data(dataset_create.file_data)
        elif dataset_create.file_type.lower() in ["xlsx", "xls"]:
            parsed_data = parse_excel_data(dataset_create.file_data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Create dataset document
        dataset_doc = {
            "name": dataset_create.name,
            "columns": parsed_data["columns"],
            "row_count": parsed_data["row_count"],
            "data": parsed_data["data"],
            "owner_id": current_user["_id"],
            "team_id": current_user.get("team_id"),
            "created_at": datetime.utcnow(),
            "file_type": dataset_create.file_type
        }
        
        result = await db.datasets.insert_one(dataset_doc)
        dataset_doc["_id"] = str(result.inserted_id)
        
        return Dataset(**dataset_doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating dataset: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing file")

@api_router.get("/datasets", response_model=List[Dataset])
async def get_datasets(current_user: dict = Depends(get_current_user)):
    query = {"$or": [
        {"owner_id": current_user["_id"]},
        {"team_id": current_user.get("team_id")}
    ]}
    
    datasets = await db.datasets.find(query).to_list(100)
    
    for ds in datasets:
        ds["_id"] = str(ds["_id"])
    
    return [Dataset(**ds) for ds in datasets]

@api_router.get("/datasets/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Check access
    if dataset["owner_id"] != current_user["_id"] and dataset.get("team_id") != current_user.get("team_id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    dataset["_id"] = str(dataset["_id"])
    return Dataset(**dataset)

@api_router.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: str, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if dataset["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete dataset")
    
    await db.datasets.delete_one({"_id": ObjectId(dataset_id)})
    await db.charts.delete_many({"config.dataset_id": dataset_id})
    
    return {"message": "Dataset deleted"}

# ===== CHART ENDPOINTS =====
@api_router.post("/charts", response_model=Chart)
async def create_chart(chart_data: Chart, current_user: dict = Depends(get_current_user)):
    chart_doc = chart_data.dict(exclude={"id"})
    chart_doc["owner_id"] = current_user["_id"]
    chart_doc["team_id"] = current_user.get("team_id")
    chart_doc["created_at"] = datetime.utcnow()
    chart_doc["updated_at"] = datetime.utcnow()
    
    result = await db.charts.insert_one(chart_doc)
    chart_doc["_id"] = str(result.inserted_id)
    
    return Chart(**chart_doc)

@api_router.get("/charts", response_model=List[Chart])
async def get_charts(current_user: dict = Depends(get_current_user)):
    query = {"$or": [
        {"owner_id": current_user["_id"]},
        {"team_id": current_user.get("team_id")}
    ]}
    
    charts = await db.charts.find(query).to_list(100)
    
    for chart in charts:
        chart["_id"] = str(chart["_id"])
    
    return [Chart(**chart) for chart in charts]

@api_router.get("/charts/{chart_id}", response_model=Chart)
async def get_chart(chart_id: str, current_user: dict = Depends(get_current_user)):
    chart = await db.charts.find_one({"_id": ObjectId(chart_id)})
    
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    chart["_id"] = str(chart["_id"])
    return Chart(**chart)

@api_router.get("/charts/{chart_id}/data")
async def get_chart_data(chart_id: str, current_user: dict = Depends(get_current_user)):
    chart = await db.charts.find_one({"_id": ObjectId(chart_id)})
    
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    # Get dataset
    dataset = await db.datasets.find_one({"_id": ObjectId(chart["config"]["dataset_id"])})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Aggregate data based on chart config
    aggregated = aggregate_data(dataset["data"], chart["config"])
    
    return {"data": aggregated, "config": chart["config"]}

@api_router.delete("/charts/{chart_id}")
async def delete_chart(chart_id: str, current_user: dict = Depends(get_current_user)):
    chart = await db.charts.find_one({"_id": ObjectId(chart_id)})
    
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    if chart["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete chart")
    
    await db.charts.delete_one({"_id": ObjectId(chart_id)})
    
    return {"message": "Chart deleted"}

# ===== DASHBOARD ENDPOINTS =====
@api_router.post("/dashboards", response_model=Dashboard)
async def create_dashboard(dashboard_data: Dashboard, current_user: dict = Depends(get_current_user)):
    dashboard_doc = dashboard_data.dict(exclude={"id"})
    dashboard_doc["owner_id"] = current_user["_id"]
    dashboard_doc["team_id"] = current_user.get("team_id")
    dashboard_doc["created_at"] = datetime.utcnow()
    dashboard_doc["updated_at"] = datetime.utcnow()
    
    result = await db.dashboards.insert_one(dashboard_doc)
    dashboard_doc["_id"] = str(result.inserted_id)
    
    return Dashboard(**dashboard_doc)

@api_router.get("/dashboards", response_model=List[Dashboard])
async def get_dashboards(current_user: dict = Depends(get_current_user)):
    query = {"$or": [
        {"owner_id": current_user["_id"]},
        {"team_id": current_user.get("team_id")},
        {"shared_with": current_user["_id"]}
    ]}
    
    dashboards = await db.dashboards.find(query).to_list(100)
    
    for dash in dashboards:
        dash["_id"] = str(dash["_id"])
    
    return [Dashboard(**dash) for dash in dashboards]

@api_router.get("/dashboards/{dashboard_id}", response_model=Dashboard)
async def get_dashboard(dashboard_id: str, current_user: dict = Depends(get_current_user)):
    dashboard = await db.dashboards.find_one({"_id": ObjectId(dashboard_id)})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    dashboard["_id"] = str(dashboard["_id"])
    return Dashboard(**dashboard)

@api_router.put("/dashboards/{dashboard_id}", response_model=Dashboard)
async def update_dashboard(dashboard_id: str, dashboard_data: Dashboard, current_user: dict = Depends(get_current_user)):
    dashboard = await db.dashboards.find_one({"_id": ObjectId(dashboard_id)})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if dashboard["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only owner can update dashboard")
    
    update_data = dashboard_data.dict(exclude={"id", "owner_id", "created_at"})
    update_data["updated_at"] = datetime.utcnow()
    
    await db.dashboards.update_one(
        {"_id": ObjectId(dashboard_id)},
        {"$set": update_data}
    )
    
    updated = await db.dashboards.find_one({"_id": ObjectId(dashboard_id)})
    updated["_id"] = str(updated["_id"])
    
    return Dashboard(**updated)

@api_router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, current_user: dict = Depends(get_current_user)):
    dashboard = await db.dashboards.find_one({"_id": ObjectId(dashboard_id)})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if dashboard["owner_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete dashboard")
    
    await db.dashboards.delete_one({"_id": ObjectId(dashboard_id)})
    
    return {"message": "Dashboard deleted"}

# ===== AI ENDPOINTS =====
@api_router.post("/ai/suggest-charts")
async def ai_suggest_charts(request: ChartSuggestionRequest, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(request.dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    suggestions = await suggest_charts(dataset["columns"])
    return suggestions

@api_router.post("/ai/query")
async def ai_natural_language_query(request: NaturalLanguageQuery, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(request.dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    session_id = request.session_id or f"user-{current_user['_id']}"
    
    result = await natural_language_query(request.query, dataset, session_id)
    return result

# ===== ANALYTICS ENDPOINTS =====
@api_router.post("/analytics/trends")
async def get_trends(request: AnalyticsRequest, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(request.dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    result = calculate_trends(dataset["data"], request.column)
    return result

@api_router.post("/analytics/forecast")
async def get_forecast(request: AnalyticsRequest, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(request.dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    result = forecast_values(dataset["data"], request.column)
    return result

@api_router.post("/analytics/statistics")
async def get_statistics(request: AnalyticsRequest, current_user: dict = Depends(get_current_user)):
    dataset = await db.datasets.find_one({"_id": ObjectId(request.dataset_id)})
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    result = calculate_statistics(dataset["data"], request.column)
    return result

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "PowerBI Clone API", "version": "1.0"}

# Include router
app.include_router(api_router)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:19006",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#origins = [
#    "http://localhost:3000",
#    "http://localhost:8081",
#    "http://localhost:19006",
#    "https://bi-kazy7hujs-abhikoli17s-projects.vercel.app",
#]


# CORS middleware
#app.add_middleware(
#    CORSMiddleware,
#    allow_credentials=True,
#    allow_origins=["*"],
#    allow_methods=["*"],
#    allow_headers=["*"],
#)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()