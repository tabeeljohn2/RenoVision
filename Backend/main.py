
import os
import shutil
import uuid
import time
from dotenv import load_dotenv
load_dotenv()
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    Depends
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import create_tables, get_db
from auth import (
    register_user,
    login_user,
    verify_token,
    get_all_users,
    google_login
)
from cv_module import analyze_room_image
from xai_module import run_xai
from genai_module import generate_room_image

backend_ready = False
startup_time = None

# ─────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────
app = FastAPI(
    title="RenoVision API",
    version="1.0",
    description="AI-Based Smart Interior Planner"
)

# ─────────────────────────────────────────
# CORS — Allow all origins
# ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# ─────────────────────────────────────────
# Upload Folder
# ─────────────────────────────────────────
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ─────────────────────────────────────────
# Startup Event
# ─────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    global backend_ready, startup_time
    startup_time = time.time()

    print("Starting RenoVision backend...")
    print(f"Environment: {os.environ.get('SPACE_ID', 'local')}")

    # Create database tables
    try:
        create_tables()
        print("✅ Database ready")
    except Exception as e:
        print(f"❌ Database error: {e}")
        print("⚠️  Continuing without database — auth will not work until DB is fixed")

    # cv_module is a Kaggle proxy — no local model to preload
    kaggle_url = os.environ.get("KAGGLE_BACKEND_URL", "")
    if kaggle_url:
        print(f"✅ Kaggle backend URL set: {kaggle_url}")
    else:
        print("⚠️  KAGGLE_BACKEND_URL not set in .env — CV and GenAI will fail")

    backend_ready = True
    print("Backend fully ready!")


# ─────────────────────────────────────────
# Route 1 — Home
# ─────────────────────────────────────────
@app.get("/")
def home():
    return {
        "message": "RenoVision API is running!",
        "version": "1.0",
        "ready": backend_ready
    }


# ─────────────────────────────────────────
# Route 2 — Health Check
# ─────────────────────────────────────────
@app.get("/health")
def health():
    uptime = round(
        time.time() - startup_time, 1
    ) if startup_time else 0
    return {
        "status": "ok",
        "ready": backend_ready,
        "uptime_seconds": uptime
    }


# ─────────────────────────────────────────
# Route 3 — Wake Up
# ─────────────────────────────────────────
@app.get("/wake")
def wake():
    return {
        "status": "awake",
        "ready": backend_ready,
        "message": "Backend is up"
            if backend_ready
            else "Warming up, please wait..."
    }


# ─────────────────────────────────────────
# Route 4 — Register
# ─────────────────────────────────────────
@app.post("/auth/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    print(f"Register request: name={name}, email={email}")

    if not name or not name.strip():
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Name is required"
            }
        )

    if not email or "@" not in email:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Valid email is required"
            }
        )

    if not password or len(password) < 6:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Password must be at least 6 characters"
            }
        )

    result = register_user(
        db,
        name.strip(),
        email.strip().lower(),
        password
    )

    print(f"Register result: {result.get('success')} — {result.get('error', 'OK')}")

    if not result["success"]:
        return JSONResponse(
            status_code=400,
            content=result
        )

    return result


# ─────────────────────────────────────────
# Route 5 — Login
# ─────────────────────────────────────────
@app.post("/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    print(f"Login request: email={email}")

    result = login_user(
        db,
        email.strip().lower(),
        password
    )

    print(f"Login result: {result.get('success')} — {result.get('error', 'OK')}")

    if not result["success"]:
        return JSONResponse(
            status_code=401,
            content=result
        )

    return result


# ─────────────────────────────────────────
# Route 6 — Google Auth
# ─────────────────────────────────────────
@app.post("/auth/google")
def google_auth(
    name: str = Form(...),
    email: str = Form(...),
    google_uid: str = Form(...),
    db: Session = Depends(get_db)
):
    print(f"Google auth: {email}")
    return google_login(
        db,
        name.strip(),
        email.strip().lower(),
        google_uid
    )


# ─────────────────────────────────────────
# Route 7 — Get All Users (Admin/Debug)
# ─────────────────────────────────────────
@app.get("/auth/users")
def get_users(db: Session = Depends(get_db)):
    users = get_all_users(db)
    print(f"Total users: {len(users)}")
    return {
        "total_users": len(users),
        "users": users
    }


# ─────────────────────────────────────────
# Route 8 — Analyze Room (Main Feature)
# ─────────────────────────────────────────
@app.post("/analyze")
async def analyze_room(
    file: UploadFile = File(...),
    budget: int = Form(50000),
    style: str = Form("modern"),
    token: str = Form(...),
    user_prompt: str = Form("")
):
    print(f"Analyze request: budget={budget}, style={style}")

    # Check backend is ready
    if not backend_ready:
        return JSONResponse(
            status_code=503,
            content={
                "error": "warming_up",
                "message": "Backend is warming up. Please wait 1-2 minutes and try again.",
                "ready": False
            }
        )

    # Verify token
    email = verify_token(token)
    if not email:
        return JSONResponse(
            status_code=401,
            content={
                "error": "Session expired. Please login again."
            }
        )

    print(f"Authorized user: {email}")

    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Only JPEG and PNG images are allowed"
            }
        )

    # Save uploaded file
    file_id = str(uuid.uuid4())
    file_extension = file.filename.split(".")[-1] \
        if "." in file.filename else "jpg"
    file_path = f"{UPLOAD_FOLDER}/{file_id}.{file_extension}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"File saved: {file_path}")
    except Exception as e:
        print(f"File save error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to process image"}
        )

    # Run CV Analysis
    try:
        cv_results = analyze_room_image(file_path)
        print(f"CV done: {cv_results.get('room_type', 'unknown')}")
    except Exception as e:
        print(f"CV error: {e}")
        if os.path.exists(file_path):
            os.remove(file_path)
        return JSONResponse(
            status_code=500,
            content={"error": f"CV analysis failed: {str(e)}"}
        )

    # Remove temp file
    if os.path.exists(file_path):
        os.remove(file_path)

    # Check outdoor — stop immediately, no XAI or GenAI
    if cv_results.get("is_outdoor", False):
        print("🌿 Outdoor image blocked — stopping pipeline")
        return JSONResponse(
            status_code=400,
            content={
                "error": "outdoor_scene",
                "message": cv_results.get("message",
                    "Outdoor image detected. Please upload an indoor room photo."),
                "is_outdoor": True
            }
        )

    # Run XAI
    try:
        xai_results = run_xai(
            room_type=cv_results["room_type"],
            detected_furniture=cv_results["detected_furniture"],
            budget=budget,
            style=style,
            density=cv_results["room_density"],
            user_prompt=user_prompt
        )
        print(f"XAI done: {len(xai_results.get('recommendations', []))} recs")
    except Exception as e:
        print(f"XAI error: {e}")
        xai_results = {
            "success": False,
            "recommendations": [],
            "summary": {
                "summary": "Could not generate recommendations.",
                "total_estimated_cost": 0,
                "budget_sufficient": True
            }
        }

    # Run GenAI
    try:
        genai_results = generate_room_image(
            room_type=cv_results["room_type"],
            style=style,
            budget=budget,
            recommendations=xai_results.get("recommendations", []),
            user_prompt=user_prompt,
            detected_furniture=cv_results.get("detected_furniture", []),
            dimensions=cv_results.get("dimensions", None)
        )
        print(f"GenAI done: {genai_results.get('success', False)}")
    except Exception as e:
        print(f"GenAI error: {e}")
        genai_results = {
            "success": False,
            "error": str(e),
            "image_base64": None
        }

    return {
        "status": "success",
        "user_email": email,
        "file_received": file.filename,
        "budget": budget,
        "style": style,
        "user_prompt": user_prompt,
        "cv_analysis": cv_results,
        "xai_results": xai_results,
        "generated_design": genai_results
    }


# ─────────────────────────────────────────
# Other Routes
# ─────────────────────────────────────────

@app.post("/recommend")
async def get_recommendations(
    room_type: str = Form("living room"),
    furniture: str = Form(""),
    budget: int = Form(50000),
    style: str = Form("modern")
):
    furniture_list = furniture.split(",") \
        if furniture else []
    return {
        "status": "success",
        "room_type": room_type,
        "detected_furniture": furniture_list,
        "budget": budget,
        "style": style,
        "recommendations": []
    }


@app.post("/explain")
async def explain_recommendation(
    recommendation: str = Form(...),
    room_type: str = Form("living room"),
    budget: int = Form(50000)
):
    return {
        "status": "success",
        "recommendation": recommendation,
        "explanation": (
            f"This suits your {room_type} "
            f"within Rs.{budget}"
        )
    }


@app.post("/visualize")
async def generate_visualization(
    room_type: str = Form("living room"),
    style: str = Form("modern"),
    budget: int = Form(50000)
):
    return {
        "status": "success",
        "message": (
            f"Generating {style} design "
            f"for {room_type}"
        )
    }


# ─────────────────────────────────────────
# Local Run
# ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )