"from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List
from datetime import datetime, timezone
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

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize ML models
predictor = StrengthPredictor()
optimizer = MixOptimizer(predictor)

# Load or train models on startup
ml_models_loaded = False

app = FastAPI()
api_router = APIRouter(prefix=\"/api\")

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
@api_router.post(\"/auth/register\")
async def register(request: RegisterRequest, response: Response):
    email = request.email.lower()
    
    # Check if user exists
    existing = await db.users.find_one({\"email\": email})
    if existing:
        raise HTTPException(status_code=400, detail=\"Email already registered\")
    
    # Create user
    user_doc = {
        \"email\": email,
        \"password_hash\": hash_password(request.password),
        \"name\": request.name,
        \"company\": request.company,
        \"role\": \"user\",
        \"subscription_tier\": \"free\",
        \"created_at\": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key=\"access_token\",
        value=access_token,
        httponly=True,
        secure=False,
        samesite=\"lax\",
        max_age=900,
        path=\"/\"
    )
    response.set_cookie(
        key=\"refresh_token\",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite=\"lax\",
        max_age=604800,
        path=\"/\"
    )
    
    return {
        \"id\": user_id,
        \"email\": email,
        \"name\": request.name,
        \"company\": request.company,
        \"role\": \"user\",
        \"subscription_tier\": \"free\"
    }

@api_router.post(\"/auth/login\")
async def login(request: LoginRequest, req: Request, response: Response):
    email = request.email.lower()
    identifier = f\"{req.client.host}:{email}\"
    
    # Check brute force
    await check_brute_force(db, identifier)
    
    # Find user
    user = await db.users.find_one({\"email\": email})
    if not user or not verify_password(request.password, user[\"password_hash\"]):
        await record_failed_login(db, identifier)
        raise HTTPException(status_code=401, detail=\"Invalid email or password\")
    
    # Clear failed attempts
    await clear_login_attempts(db, identifier)
    
    # Create tokens
    user_id = str(user[\"_id\"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key=\"access_token\",
        value=access_token,
        httponly=True,
        secure=False,
        samesite=\"lax\",
        max_age=900,
        path=\"/\"
    )
    response.set_cookie(
        key=\"refresh_token\",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite=\"lax\",
        max_age=604800,
        path=\"/\"
    )
    
    return {
        \"id\": user_id,
        \"email\": user[\"email\"],
        \"name\": user[\"name\"],
        \"company\": user.get(\"company\"),
        \"role\": user[\"role\"],
        \"subscription_tier\": user.get(\"subscription_tier\", \"free\")
    }

@api_router.post(\"/auth/logout\")
async def logout(response: Response):
    response.delete_cookie(\"access_token\", path=\"/\")
    response.delete_cookie(\"refresh_token\", path=\"/\")
    return {\"message\": \"Logged out successfully\"}

@api_router.get(\"/auth/me\")
async def get_me(request: Request):
    user = await get_current_user(request, db)
    return user

@api_router.post(\"/auth/forgot-password\")
async def forgot_password(request: ForgotPasswordRequest):
    email = request.email.lower()
    user = await db.users.find_one({\"email\": email})
    
    if not user:
        # Don't reveal if email exists
        return {\"message\": \"If the email exists, a reset link will be sent\"}
    
    # Generate reset token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=1)
    
    await db.password_reset_tokens.insert_one({
        \"token\": token,
        \"user_id\": user[\"_id\"],
        \"expires_at\": expires_at,
        \"used\": False
    })
    
    # In production, send email. For now, log to console
    reset_link = f\"{os.environ.get('FRONTEND_URL')}/reset-password?token={token}\"
    logging.info(f\"Password reset link: {reset_link}\")
    
    return {\"message\": \"If the email exists, a reset link will be sent\"}

@api_router.post(\"/auth/reset-password\")
async def reset_password(request: ResetPasswordRequest):
    token_doc = await db.password_reset_tokens.find_one({
        \"token\": request.token,
        \"used\": False
    })
    
    if not token_doc:
        raise HTTPException(status_code=400, detail=\"Invalid or expired reset token\")
    
    if datetime.now(timezone.utc) > token_doc[\"expires_at\"]:
        raise HTTPException(status_code=400, detail=\"Reset token has expired\")
    
    # Update password
    await db.users.update_one(
        {\"_id\": token_doc[\"user_id\"]},
        {\"$set\": {\"password_hash\": hash_password(request.new_password)}}
    )
    
    # Mark token as used
    await db.password_reset_tokens.update_one(
        {\"_id\": token_doc[\"_id\"]},
        {\"$set\": {\"used\": True}}
    )
    
    return {\"message\": \"Password reset successfully\"}

# ML Endpoints
@api_router.post(\"/predict-strength\")
async def predict_strength(mix_input: MixDesignInput, request: Request):
    user = await get_current_user(request, db)
    
    if not ml_models_loaded:
        raise HTTPException(status_code=503, detail=\"ML models are still loading. Please try again.\")
    
    mix_data = {
        'cement': mix_input.cement,
        'slag': mix_input.slag,
        'fly_ash': mix_input.fly_ash,
        'water': mix_input.water,
        'superplasticizer': mix_input.superplasticizer,
        'coarse_aggregate': mix_input.coarse_aggregate,
        'fine_aggregate': mix_input.fine_aggregate
    }
    
    # Get predictions for different ages
    prediction_7d = predictor.predict_strength(mix_data, age=7)
    prediction_28d = predictor.predict_strength(mix_data, age=28)
    prediction_56d = predictor.predict_strength(mix_data, age=56)
    
    # Calculate water-cement ratio
    w_c_ratio = mix_input.water / mix_input.cement
    
    # Save prediction to database
    prediction_doc = {
        \"user_id\": user[\"_id\"],
        \"mix_design\": mix_data,
        \"predictions\": {
            \"7_day\": prediction_7d[\"predicted_strength\"],
            \"28_day\": prediction_28d[\"predicted_strength\"],
            \"56_day\": prediction_56d[\"predicted_strength\"]
        },
        \"confidence\": prediction_28d[\"confidence\"],
        \"water_cement_ratio\": w_c_ratio,
        \"created_at\": datetime.now(timezone.utc)
    }
    
    await db.predictions.insert_one(prediction_doc)
    
    return {
        \"predictions\": {
            \"7_day_strength\": round(prediction_7d[\"predicted_strength\"], 2),
            \"28_day_strength\": round(prediction_28d[\"predicted_strength\"], 2),
            \"56_day_strength\": round(prediction_56d[\"predicted_strength\"], 2)
        },
        \"confidence_score\": round(prediction_28d[\"confidence\"], 1),
        \"water_cement_ratio\": round(w_c_ratio, 3),
        \"model_details\": {
            \"rf_prediction\": round(prediction_28d[\"rf_prediction\"], 2),
            \"nn_prediction\": round(prediction_28d[\"nn_prediction\"], 2)
        }
    }

@api_router.post(\"/optimize-mix\")
async def optimize_mix(opt_request: OptimizationRequest, request: Request):
    user = await get_current_user(request, db)
    
    if not ml_models_loaded:
        raise HTTPException(status_code=503, detail=\"ML models are still loading. Please try again.\")
    
    # Run optimization
    result = optimizer.optimize_mix_design(
        opt_request.target_strength,
        opt_request.material_costs
    )
    
    # Save optimization to database
    opt_doc = {
        \"user_id\": user[\"_id\"],
        \"target_strength\": opt_request.target_strength,
        \"optimized_mix\": result[\"optimized_mix\"],
        \"predicted_strengths\": result[\"predicted_strengths\"],
        \"total_cost\": result[\"total_cost\"],
        \"carbon_footprint\": result[\"carbon_footprint\"],
        \"created_at\": datetime.now(timezone.utc)
    }
    
    await db.optimizations.insert_one(opt_doc)
    
    return result

@api_router.post(\"/calculate-cost\")
async def calculate_cost(cost_request: CostCalculationRequest, request: Request):
    user = await get_current_user(request, db)
    
    total_cost = optimizer.calculate_cost(
        cost_request.mix_proportions,
        cost_request.material_costs
    )
    
    # Calculate cost breakdown
    breakdown = {
        material: round(cost_request.mix_proportions[material] * cost_request.material_costs.get(material, 0), 2)
        for material in cost_request.mix_proportions.keys()
    }
    
    return {
        \"total_cost_per_m3\": round(total_cost, 2),
        \"cost_breakdown\": breakdown,
        \"currency\": \"USD\"
    }

@api_router.post(\"/calculate-carbon\")
async def calculate_carbon(mix_proportions: Dict[str, float], request: Request):
    user = await get_current_user(request, db)
    
    carbon_footprint = optimizer.calculate_carbon_footprint(mix_proportions)
    suggestions = optimizer.suggest_carbon_reduction(mix_proportions)
    
    return {
        \"total_carbon_footprint\": round(carbon_footprint, 2),
        \"unit\": \"kg CO2 per m³\",
        \"reduction_suggestions\": suggestions
    }

@api_router.get(\"/dashboard/stats\")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request, db)
    
    # Get user statistics
    total_predictions = await db.predictions.count_documents({\"user_id\": user[\"_id\"]})
    total_optimizations = await db.optimizations.count_documents({\"user_id\": user[\"_id\"]})
    
    # Get recent predictions
    recent_predictions = await db.predictions.find(
        {\"user_id\": user[\"_id\"]},
        {\"_id\": 0}
    ).sort(\"created_at\", -1).limit(5).to_list(5)
    
    return {
        \"total_predictions\": total_predictions,
        \"total_optimizations\": total_optimizations,
        \"recent_predictions\": recent_predictions,
        \"subscription_tier\": user.get(\"subscription_tier\", \"free\")
    }

# Admin seed function
async def seed_admin():
    admin_email = os.environ.get(\"ADMIN_EMAIL\", \"admin@concretemix.ai\")
    admin_password = os.environ.get(\"ADMIN_PASSWORD\", \"Admin@123\")
    
    existing = await db.users.find_one({\"email\": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            \"email\": admin_email,
            \"password_hash\": hashed,
            \"name\": \"Admin\",
            \"role\": \"admin\",
            \"subscription_tier\": \"enterprise\",
            \"created_at\": datetime.now(timezone.utc)
        })
        logging.info(f\"Admin user created: {admin_email}\")
    elif not verify_password(admin_password, existing[\"password_hash\"]):
        await db.users.update_one(
            {\"email\": admin_email},
            {\"$set\": {\"password_hash\": hash_password(admin_password)}}
        )
        logging.info(\"Admin password updated\")
    
    # Write credentials to file
    credentials_path = Path(\"/app/memory\")
    credentials_path.mkdir(exist_ok=True)
    
    with open(credentials_path / \"test_credentials.md\", \"w\") as f:
        f.write(\"# Test Credentials

\")
        f.write(\"## Admin Account
\")
        f.write(f\"- Email: {admin_email}
\")
        f.write(f\"- Password: {admin_password}
\")
        f.write(f\"- Role: admin

\")
        f.write(\"## Auth Endpoints
\")
        f.write(\"- POST /api/auth/register
\")
        f.write(\"- POST /api/auth/login
\")
        f.write(\"- GET /api/auth/me
\")
        f.write(\"- POST /api/auth/logout
\")

# Startup event
@app.on_event(\"startup\")
async def startup_event():
    global ml_models_loaded
    
    # Create indexes
    await db.users.create_index(\"email\", unique=True)
    await db.login_attempts.create_index(\"identifier\")
    await db.password_reset_tokens.create_index(\"expires_at\", expireAfterSeconds=0)
    
    # Seed admin
    await seed_admin()
    
    # Load or train ML models
    logging.info(\"Loading ML models...\")
    if not predictor.load_models():
        logging.info(\"Models not found. Training new models...\")
        from ml_models.dataset_loader import ConcreteDataLoader
        
        loader = ConcreteDataLoader()
        X_train, X_test, y_train, y_test, feature_names = loader.prepare_data()
        
        predictor.train_models(X_train, X_test, y_train, y_test)
        predictor.save_models(loader.scaler)
        logging.info(\"Model training completed\")
    
    ml_models_loaded = True
    logging.info(\"ML models loaded successfully\")

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get(\"FRONTEND_URL\", \"http://localhost:3000\")],
    allow_credentials=True,
    allow_methods=[\"*\"],
    allow_headers=[\"*\"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event(\"shutdown\")
async def shutdown_db_client():
    client.close()