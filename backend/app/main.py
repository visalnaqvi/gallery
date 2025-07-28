from fastapi import FastAPI
from .routes import images

app = FastAPI(title="Gallery App")

# Include routes
app.include_router(images.router, prefix="/images", tags=["Images"])

@app.get("/")
def root():
    return {"message": "Gallery App API is running"}
