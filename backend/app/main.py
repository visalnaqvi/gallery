from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import images  # remove the leading dot if you're running this as the main app

app = FastAPI(title="Gallery App")

# ✅ Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to specific domains instead of "*"
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# ✅ Include routes
app.include_router(images.router, prefix="/images", tags=["Images"])

@app.get("/")
def root():
    return {"message": "Gallery App API is running"}
