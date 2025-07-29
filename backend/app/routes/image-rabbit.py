from fastapi import APIRouter, UploadFile, Form, File, HTTPException, BackgroundTasks
from typing import List, Optional
from config.firebase_config import bucket
import uuid
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import logging
from dataclasses import dataclass, asdict
import json
import aio_pika
from aio_pika import Message, DeliveryMode
from contextlib import asynccontextmanager
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for CPU-bound operations
executor = ThreadPoolExecutor(max_workers=10)

# Semaphore to limit concurrent uploads
upload_semaphore = asyncio.Semaphore(20)

# RabbitMQ Configuration
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE_NAME = "file_uploads"
ROUTING_KEY_SUCCESS = "upload.success"
ROUTING_KEY_FAILURE = "upload.failure"
ROUTING_KEY_BATCH_START = "upload.batch.start"
ROUTING_KEY_BATCH_COMPLETE = "upload.batch.complete"

# Global connection pool
rabbitmq_connection = None
rabbitmq_channel = None
rabbitmq_exchange = None

@dataclass
class FileData:
    """Container for file data to avoid file closure issues"""
    filename: str
    content: bytes
    content_type: str
    size: int

class UploadResult:
    def __init__(self, filename: str, success: bool, url: str = None, error: str = None, file_size: int = 0):
        self.filename = filename
        self.success = success
        self.url = url
        self.error = error
        self.file_size = file_size
        
    def to_dict(self):
        return {
            "filename": self.filename,
            "success": self.success,
            "url": self.url,
            "error": self.error,
            "file_size": self.file_size
        }

@dataclass
class UploadEvent:
    """Event data structure for RabbitMQ messages"""
    event_id: str
    upload_id: str
    user_id: str
    group_id: str
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    firebase_path: str
    public_url: str = None
    success: bool = True
    error_message: str = None
    timestamp: str = None
    processing_time_seconds: float = 0.0
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

@dataclass
class BatchEvent:
    """Batch upload event data structure"""
    batch_id: str
    user_id: str
    group_id: str
    total_files: int
    successful_uploads: int = 0
    failed_uploads: int = 0
    total_size_bytes: int = 0
    processing_time_seconds: float = 0.0
    timestamp: str = None
    status: str = "started"  # started, completed, failed
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

async def init_rabbitmq():
    """Initialize RabbitMQ connection and exchange"""
    global rabbitmq_connection, rabbitmq_channel, rabbitmq_exchange
    
    try:
        rabbitmq_connection = await aio_pika.connect_robust(RABBITMQ_URL)
        rabbitmq_channel = await rabbitmq_connection.channel()
        
        # Declare exchange
        rabbitmq_exchange = await rabbitmq_channel.declare_exchange(
            EXCHANGE_NAME, 
            aio_pika.ExchangeType.TOPIC,
            durable=True
        )
        
        logger.info("RabbitMQ connection established")
        
    except Exception as e:
        logger.error(f"Failed to initialize RabbitMQ: {str(e)}")
        raise

async def close_rabbitmq():
    """Close RabbitMQ connection"""
    global rabbitmq_connection
    
    if rabbitmq_connection and not rabbitmq_connection.is_closed:
        await rabbitmq_connection.close()
        logger.info("RabbitMQ connection closed")

async def publish_event(routing_key: str, event_data: dict):
    """Publish event to RabbitMQ"""
    try:
        if not rabbitmq_exchange:
            logger.error("RabbitMQ not initialized")
            return
            
        message = Message(
            json.dumps(event_data, default=str).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
            headers={
                "event_type": routing_key,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        await rabbitmq_exchange.publish(message, routing_key=routing_key)
        logger.info(f"Published event: {routing_key} for {event_data.get('filename', 'batch')}")
        
    except Exception as e:
        logger.error(f"Failed to publish event {routing_key}: {str(e)}")

async def read_files_sequentially(files: List[UploadFile]) -> List[FileData]:
    """Read all files sequentially to avoid file closure issues"""
    file_data_list = []
    
    for file in files:
        try:
            # Ensure we're at the beginning of the file
            await file.seek(0)
            content = await file.read()
            
            file_data = FileData(
                filename=file.filename,
                content=content,
                content_type=file.content_type,
                size=len(content)
            )
            file_data_list.append(file_data)
            logger.info(f"Read file {file.filename}: {len(content)} bytes")
            
        except Exception as e:
            logger.error(f"Failed to read file {file.filename}: {str(e)}")
            # Create a placeholder with error info
            file_data = FileData(
                filename=file.filename,
                content=b'',
                content_type='application/octet-stream',
                size=0
            )
            file_data_list.append(file_data)
    
    return file_data_list

async def upload_single_file(user_id: str, group_id: str, file_data: FileData, upload_id: str) -> UploadResult:
    """Upload a single file to Firebase Storage and emit RabbitMQ events"""
    async with upload_semaphore:
        start_time = time.time()
        event_id = str(uuid.uuid4())
        unique_name = f"{uuid.uuid4()}_{file_data.filename}"
        firebase_path = f"{user_id}/{group_id}/image/{unique_name}"
        
        try:
            if file_data.size == 0:
                # Emit failure event
                error_event = UploadEvent(
                    event_id=event_id,
                    upload_id=upload_id,
                    user_id=user_id,
                    group_id=group_id,
                    filename=unique_name,
                    original_filename=file_data.filename,
                    file_size=file_data.size,
                    content_type=file_data.content_type,
                    firebase_path=firebase_path,
                    success=False,
                    error_message="File is empty or couldn't be read",
                    processing_time_seconds=time.time() - start_time
                )
                
                await publish_event(ROUTING_KEY_FAILURE, asdict(error_event))
                return UploadResult(file_data.filename, False, error="File is empty or couldn't be read", file_size=file_data.size)
            
            # Upload to Firebase Storage in thread pool
            def upload_to_storage():
                blob = bucket.blob(firebase_path)
                blob.upload_from_string(
                    file_data.content, 
                    content_type=file_data.content_type
                )
                blob.make_public()
                return blob.public_url
            
            loop = asyncio.get_event_loop()
            public_url = await loop.run_in_executor(executor, upload_to_storage)
            
            upload_time = time.time() - start_time
            logger.info(f"Successfully uploaded {unique_name} in {upload_time:.2f}s")
            
            # Emit success event
            success_event = UploadEvent(
                event_id=event_id,
                upload_id=upload_id,
                user_id=user_id,
                group_id=group_id,
                filename=unique_name,
                original_filename=file_data.filename,
                file_size=file_data.size,
                content_type=file_data.content_type,
                firebase_path=firebase_path,
                public_url=public_url,
                success=True,
                processing_time_seconds=upload_time
            )
            
            await publish_event(ROUTING_KEY_SUCCESS, asdict(success_event))
            
            return UploadResult(file_data.filename, True, public_url, file_size=file_data.size)
            
        except Exception as e:
            upload_time = time.time() - start_time
            logger.error(f"Upload failed for {file_data.filename}: {str(e)}")
            
            # Emit failure event
            error_event = UploadEvent(
                event_id=event_id,
                upload_id=upload_id,
                user_id=user_id,
                group_id=group_id,
                filename=unique_name,
                original_filename=file_data.filename,
                file_size=file_data.size,
                content_type=file_data.content_type,
                firebase_path=firebase_path,
                success=False,
                error_message=str(e),
                processing_time_seconds=upload_time
            )
            
            await publish_event(ROUTING_KEY_FAILURE, asdict(error_event))
            
            return UploadResult(file_data.filename, False, error=str(e), file_size=file_data.size)

@router.post("/upload/")
async def upload_images(
    user_id: str = Form(...),
    group_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Main upload endpoint with RabbitMQ events"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    # Validate file count
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Too many files. Maximum 50 files per request")
    
    upload_id = str(uuid.uuid4())
    start_time = time.time()
    
    logger.info(f"Starting upload batch {upload_id} with {len(files)} files for user {user_id}, group {group_id}")
    
    try:
        # Step 1: Read all files sequentially
        logger.info("Reading files...")
        file_data_list = await read_files_sequentially(files)
        
        # Step 2: Validate file sizes after reading
        max_file_size = 10 * 1024 * 1024  # 10MB
        total_size = sum(f.size for f in file_data_list)
        
        for file_data in file_data_list:
            if file_data.size > max_file_size:
                raise HTTPException(
                    status_code=400, 
                    detail=f"File {file_data.filename} is too large. Maximum size is 10MB"
                )
        
        # Emit batch start event
        batch_start_event = BatchEvent(
            batch_id=upload_id,
            user_id=user_id,
            group_id=group_id,
            total_files=len(file_data_list),
            total_size_bytes=total_size,
            status="started"
        )
        await publish_event(ROUTING_KEY_BATCH_START, asdict(batch_start_event))
        
        # Step 3: Upload all files concurrently
        logger.info("Starting concurrent uploads...")
        upload_tasks = [
            upload_single_file(user_id, group_id, file_data, upload_id) 
            for file_data in file_data_list
        ]
        
        results = await asyncio.gather(*upload_tasks, return_exceptions=True)
        
        # Handle any unexpected exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(
                    UploadResult(file_data_list[i].filename, False, error=str(result), file_size=file_data_list[i].size)
                )
            else:
                processed_results.append(result)
        
        # Gather statistics
        successful_uploads = sum(1 for r in processed_results if r.success)
        failed_uploads = len(processed_results) - successful_uploads
        total_time = time.time() - start_time
        
        # Emit batch complete event
        batch_complete_event = BatchEvent(
            batch_id=upload_id,
            user_id=user_id,
            group_id=group_id,
            total_files=len(file_data_list),
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads,
            total_size_bytes=total_size,
            processing_time_seconds=total_time,
            status="completed"
        )
        await publish_event(ROUTING_KEY_BATCH_COMPLETE, asdict(batch_complete_event))
        
        logger.info(
            f"Upload batch {upload_id} completed: {successful_uploads} successful, {failed_uploads} failed "
            f"in {total_time:.2f}s"
        )
        
        return {
            "upload_id": upload_id,
            "message": f"Processed {len(files)} files",
            "successful_uploads": successful_uploads,
            "failed_uploads": failed_uploads,
            "processing_time": f"{total_time:.2f}s",
            "total_size_mb": f"{total_size / 1024 / 1024:.2f}",
            "results": [r.to_dict() for r in processed_results]
        }
        
    except Exception as e:
        logger.error(f"Batch upload {upload_id} failed: {str(e)}")
        
        # Emit batch failure event
        batch_failure_event = BatchEvent(
            batch_id=upload_id,
            user_id=user_id,
            group_id=group_id,
            total_files=len(files),
            processing_time_seconds=time.time() - start_time,
            status="failed"
        )
        await publish_event(ROUTING_KEY_BATCH_COMPLETE, asdict(batch_failure_event))
        
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload/background/")
async def upload_images_background(
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    group_id: str = Form(...),
    files: List[UploadFile] = File(...),
    webhook_url: Optional[str] = Form(None)
):
    """Upload files in background with RabbitMQ events"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    upload_id = str(uuid.uuid4())
    
    # Read files immediately in the request context
    try:
        file_data_list = await read_files_sequentially(files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read files: {str(e)}")
    
    async def background_upload():
        start_time = time.time()
        total_size = sum(f.size for f in file_data_list)
        
        try:
            # Emit batch start event
            batch_start_event = BatchEvent(
                batch_id=upload_id,
                user_id=user_id,
                group_id=group_id,
                total_files=len(file_data_list),
                total_size_bytes=total_size,
                status="started"
            )
            await publish_event(ROUTING_KEY_BATCH_START, asdict(batch_start_event))
            
            # Upload using pre-read file data
            upload_tasks = [
                upload_single_file(user_id, group_id, file_data, upload_id) 
                for file_data in file_data_list
            ]
            
            results = await asyncio.gather(*upload_tasks, return_exceptions=True)
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append(
                        UploadResult(file_data_list[i].filename, False, error=str(result), file_size=file_data_list[i].size)
                    )
                else:
                    processed_results.append(result)
            
            successful_uploads = sum(1 for r in processed_results if r.success)
            failed_uploads = len(processed_results) - successful_uploads
            total_time = time.time() - start_time
            
            # Emit batch complete event
            batch_complete_event = BatchEvent(
                batch_id=upload_id,
                user_id=user_id,
                group_id=group_id,
                total_files=len(file_data_list),
                successful_uploads=successful_uploads,
                failed_uploads=failed_uploads,
                total_size_bytes=total_size,
                processing_time_seconds=total_time,
                status="completed"
            )
            await publish_event(ROUTING_KEY_BATCH_COMPLETE, asdict(batch_complete_event))
            
            logger.info(f"Background upload {upload_id} completed: {successful_uploads}/{len(file_data_list)} successful")
            
            # Optional webhook notification
            if webhook_url:
                import httpx
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(webhook_url, json={
                            "upload_id": upload_id,
                            "status": "completed",
                            "successful_uploads": successful_uploads,
                            "failed_uploads": failed_uploads,
                            "total_files": len(file_data_list),
                            "processing_time": total_time,
                            "results": [r.to_dict() for r in processed_results]
                        })
                        logger.info(f"Webhook notification sent for upload {upload_id}")
                except Exception as webhook_error:
                    logger.error(f"Webhook notification failed for upload {upload_id}: {str(webhook_error)}")
                    
        except Exception as e:
            logger.error(f"Background upload {upload_id} failed: {str(e)}")
            
            # Emit batch failure event
            batch_failure_event = BatchEvent(
                batch_id=upload_id,
                user_id=user_id,
                group_id=group_id,
                total_files=len(file_data_list),
                processing_time_seconds=time.time() - start_time,
                status="failed"
            )
            await publish_event(ROUTING_KEY_BATCH_COMPLETE, asdict(batch_failure_event))
            
            # Send failure webhook if provided
            if webhook_url:
                import httpx
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(webhook_url, json={
                            "upload_id": upload_id,
                            "status": "failed",
                            "error": str(e)
                        })
                except Exception as webhook_error:
                    logger.error(f"Failure webhook notification failed for upload {upload_id}: {str(webhook_error)}")
    
    background_tasks.add_task(background_upload)
    
    return {
        "message": "Upload started in background",
        "upload_id": upload_id,
        "status": "processing",
        "files_queued": len(file_data_list)
    }

@router.get("/health")
async def health_check():
    rabbitmq_status = "connected" if rabbitmq_connection and not rabbitmq_connection.is_closed else "disconnected"
    
    return {
        "status": "healthy",
        "available_upload_slots": upload_semaphore._value,
        "max_concurrent_uploads": 20,
        "rabbitmq_status": rabbitmq_status
    }

# Startup and shutdown events
@router.on_event("startup")
async def startup_event():
    await init_rabbitmq()

@router.on_event("shutdown") 
async def shutdown_event():
    await close_rabbitmq()