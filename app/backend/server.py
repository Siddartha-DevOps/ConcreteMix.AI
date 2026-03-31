from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List
from datetime import datetime, timezone, timedelta
import os
import logging
from pathlib import Path
from bson import ObjectId
import secrets

from auth_utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user, check_brute_force, record_failed_login, clear_login_attempts
)
from ml_models import StrengthPredictor, MixOptimizer
from copilot_engine import ConcreteCopilot

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize ML models
predictor = StrengthPredictor()
optimizer = MixOptimizer(predictor)
copilot  = ConcreteCopilot()

# Load or train models on startup
ml_models_loaded = False

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    company: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MixDesignInput(BaseModel):
    cement: float
    water: float
    fly_ash: float
    slag: float
    fine_aggregate: float
    coarse_aggregate: float
    superplasticizer: float
    age: int = 28

class OptimizationRequest(BaseModel):
    target_strength: float
    material_costs: Dict[str, float]

class CostCalculationRequest(BaseModel):
    mix_proportions: Dict[str, float]
    material_costs: Dict[str, float]

# Auth Endpoints
@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    email = request.email.lower()

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "email": email,
        "password_hash": hash_password(request.password),
        "name": request.name,
        "company": request.company,
        "role": "user",
        "subscription_tier": "free",
        "created_at": datetime.now(timezone.utc)
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {
        "id": user_id,
        "email": email,
        "name": request.name,
        "company": request.company,
        "role": "user",
        "subscription_tier": "free"
    }

@api_router.post("/auth/login")
async def login(request: LoginRequest, req: Request, response: Response):
    email = request.email.lower()
    identifier = f"{req.client.host}:{email}"

    await check_brute_force(db, identifier)

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(request.password, user["password_hash"]):
        await record_failed_login(db, identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await clear_login_attempts(db, identifier)

    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

    return {
        "id": user_id,
        "email": user["email"],
        "name": user["name"],
        "company": user.get("company"),
        "role": user["role"],
        "subscription_tier": user.get("subscription_tier", "free")
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request, db)
    return user

# ML Endpoints
@api_router.post("/predict-strength")
async def predict_strength(mix_input: MixDesignInput, request: Request):
    user = await get_current_user(request, db)

    if not ml_models_loaded:
        raise HTTPException(status_code=503, detail="ML models are still loading. Please try again.")

    mix_data = {
        'cement': mix_input.cement,
        'slag': mix_input.slag,
        'fly_ash': mix_input.fly_ash,
        'water': mix_input.water,
        'superplasticizer': mix_input.superplasticizer,
        'coarse_aggregate': mix_input.coarse_aggregate,
        'fine_aggregate': mix_input.fine_aggregate
    }

    prediction_7d = predictor.predict_strength(mix_data, age=7)
    prediction_28d = predictor.predict_strength(mix_data, age=28)
    prediction_56d = predictor.predict_strength(mix_data, age=56)

    w_c_ratio = mix_input.water / mix_input.cement

    prediction_doc = {
        "user_id": user["_id"],
        "mix_design": mix_data,
        "predictions": {
            "7_day": prediction_7d["predicted_strength"],
            "28_day": prediction_28d["predicted_strength"],
            "56_day": prediction_56d["predicted_strength"]
        },
        "water_cement_ratio": w_c_ratio,
        "created_at": datetime.now(timezone.utc)
    }
    await db.predictions.insert_one(prediction_doc)

    return {
        "strength_7day": round(prediction_7d["predicted_strength"], 2),
        "strength_28day": round(prediction_28d["predicted_strength"], 2),
        "strength_56day": round(prediction_56d["predicted_strength"], 2),
        "confidence_score": round(prediction_28d.get("confidence", 90.0), 1),
        "water_cement_ratio": round(w_c_ratio, 3)
    }

@api_router.post("/optimize-mix")
async def optimize_mix(opt_request: OptimizationRequest, request: Request):
    user = await get_current_user(request, db)

    if not ml_models_loaded:
        raise HTTPException(status_code=503, detail="ML models are still loading. Please try again.")

    result = optimizer.optimize_mix_design(opt_request.target_strength, opt_request.material_costs)

    opt_doc = {
        "user_id": user["_id"],
        "target_strength": opt_request.target_strength,
        "optimized_mix": result["optimized_mix"],
        "total_cost": result["total_cost"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.optimizations.insert_one(opt_doc)

    return result

@api_router.post("/calculate-cost")
async def calculate_cost(cost_request: CostCalculationRequest, request: Request):
    user = await get_current_user(request, db)

    total_cost = optimizer.calculate_cost(cost_request.mix_proportions, cost_request.material_costs)

    breakdown = {
        material: round(cost_request.mix_proportions[material] * cost_request.material_costs.get(material, 0), 2)
        for material in cost_request.mix_proportions.keys()
    }

    return {
        "total_cost_per_m3": round(total_cost, 2),
        "cost_breakdown": breakdown,
        "currency": "USD"
    }

@api_router.post("/calculate-carbon")
async def calculate_carbon(mix_proportions: Dict[str, float], request: Request):
    user = await get_current_user(request, db)

    carbon_footprint = optimizer.calculate_carbon_footprint(mix_proportions)
    suggestions = optimizer.suggest_carbon_reduction(mix_proportions)

    return {
        "total_carbon_footprint": round(carbon_footprint, 2),
        "unit": "kg CO2 per m³",
        "reduction_suggestions": suggestions
    }

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request, db)

    total_predictions = await db.predictions.count_documents({"user_id": user["_id"]})
    total_optimizations = await db.optimizations.count_documents({"user_id": user["_id"]})

    return {
        "total_predictions": total_predictions,
        "total_optimizations": total_optimizations,
        "subscription_tier": user.get("subscription_tier", "free")
    }

@api_router.get("/")
async def root():
    return {"message": "ConcreteMix.AI API is running"}

# ── Copilot Endpoints ─────────────────────────────────────────────────────────

class CopilotMessage(BaseModel):
    message: str

@api_router.post("/copilot/chat")
async def copilot_chat(body: CopilotMessage, request: Request):
    user = await get_current_user(request, db)
    user_id = user["_id"]

    # Load conversation history for this user (last 10 turns)
    cursor = db.copilot_conversations.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(10)
    history = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc["user_id"] = str(doc["user_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        history.append(doc)
    history.reverse()

    # Run the copilot engine
    result = copilot.process(
        message=body.message,
        conversation_history=history,
        predictor=predictor,
        optimizer=optimizer
    )

    # Save user message + agent response to MongoDB
    now = datetime.now(timezone.utc)
    await db.copilot_conversations.insert_one({
        "user_id": user_id,
        "role": "user",
        "content": body.message,
        "created_at": now
    })
    await db.copilot_conversations.insert_one({
        "user_id": user_id,
        "role": "agent",
        "content": result["message"],
        "intent": result.get("intent"),
        "steps": result.get("steps", []),
        "data": result.get("data", {}),
        "mix_data": result.get("mix_data"),
        "params": {
            "target_strength": None,
            "raw_grade": None,
        },
        "created_at": now
    })

    return result

@api_router.get("/copilot/history")
async def copilot_history(request: Request):
    user = await get_current_user(request, db)
    cursor = db.copilot_conversations.find(
        {"user_id": user["_id"]}
    ).sort("created_at", 1).limit(100)

    messages = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc["user_id"] = str(doc["user_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        messages.append(doc)
    return messages

@api_router.delete("/copilot/history")
async def clear_copilot_history(request: Request):
    user = await get_current_user(request, db)
    await db.copilot_conversations.delete_many({"user_id": user["_id"]})
    return {"message": "Conversation cleared"}

# History Endpoints
@api_router.get("/history")
async def get_history(request: Request):
    user = await get_current_user(request, db)
    cursor = db.predictions.find(
        {"user_id": user["_id"]},
        {"password_hash": 0}
    ).sort("created_at", -1).limit(100)

    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        doc["user_id"] = str(doc["user_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        results.append(doc)
    return results

@api_router.delete("/history/{prediction_id}")
async def delete_history(prediction_id: str, request: Request):
    user = await get_current_user(request, db)
    result = await db.predictions.delete_one({
        "_id": ObjectId(prediction_id),
        "user_id": ObjectId(user["_id"])
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"message": "Deleted successfully"}

# ── Admin helper ──────────────────────────────────────────────────────────────
async def require_admin(request: Request):
    user = await get_current_user(request, db)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Admin Endpoints
@api_router.get("/admin/users")
async def admin_get_users(request: Request):
    await require_admin(request)
    cursor = db.users.find({}, {"password_hash": 0})
    users = []
    async for u in cursor:
        u["id"] = str(u.pop("_id"))
        if "created_at" in u:
            u["created_at"] = u["created_at"].isoformat()
        users.append(u)
    return users

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request):
    admin = await require_admin(request)
    if str(admin["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

class RoleUpdate(BaseModel):
    role: str

@api_router.patch("/admin/users/{user_id}/role")
async def admin_update_role(user_id: str, body: RoleUpdate, request: Request):
    admin = await require_admin(request)
    if body.role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": body.role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Role updated"}

@api_router.get("/admin/stats")
async def admin_get_stats(request: Request):
    await require_admin(request)
    total_users = await db.users.count_documents({})
    admin_count = await db.users.count_documents({"role": "admin"})
    total_predictions = await db.predictions.count_documents({})
    total_optimizations = await db.optimizations.count_documents({})
    return {
        "total_users": total_users,
        "admin_count": admin_count,
        "total_predictions": total_predictions,
        "total_optimizations": total_optimizations,
    }

# Admin seed
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@concretemix.ai")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "subscription_tier": "enterprise",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")

# Startup
@app.on_event("startup")
async def startup_event():
    global ml_models_loaded

    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")

    await seed_admin()

    logger.info("Loading ML models...")
    if not predictor.load_models():
        logger.info("Models not found. Training new models...")
        from ml_models.dataset_loader import ConcreteDataLoader
        loader = ConcreteDataLoader()
        X_train, X_test, y_train, y_test, feature_names = loader.prepare_data()
        predictor.train_models(X_train, X_test, y_train, y_test)
        predictor.save_models(loader.scaler)
        logger.info("Model training completed")

    ml_models_loaded = True
    logger.info("ML models loaded successfully")

# Include router
app.include_router(api_router)

# CORS — must come after include_router
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3001")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()