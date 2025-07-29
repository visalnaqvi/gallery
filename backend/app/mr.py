from fastapi import FastAPI
from contextlib import asynccontextmanager
import aio_pika
import logging
import os

# Import your upload router
from app.routes.images import router as images_router, init_rabbitmq, close_rabbitmq

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    logger.info("Starting up FastAPI application...")
    try:
        await init_rabbitmq()
        logger.info("Application startup completed successfully")
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("Shutting down FastAPI application...")
    try:
        await close_rabbitmq()
        logger.info("Application shutdown completed successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Create FastAPI app with lifespan management
app = FastAPI(
    title="Image Upload API with RabbitMQ",
    description="Upload images to Firebase Storage with RabbitMQ event publishing",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(images_router, prefix="/images", tags=["Images"])

@app.get("/")
async def root():
    return {
        "message": "Image Upload API with RabbitMQ Events",
        "docs": "/docs",
        "health": "/images/health"
    }

if __name__ == "__main__":
    import uvicorn
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=1,  # Use 1 worker with RabbitMQ connections
        log_level="info"
    )