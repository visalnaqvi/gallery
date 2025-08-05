from fastapi import APIRouter, UploadFile, Form, File, HTTPException, BackgroundTasks
from typing import List, Optional
from config.firebase_config import bucket
import uuid
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import logging
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for CPU-bound operations
executor = ThreadPoolExecutor(max_workers=10)

# Semaphore to limit concurrent uploads
upload_semaphore = asyncio.Semaphore(20)

@dataclass
class FileData:
    """Container for file data to avoid file closure issues"""
    filename: str
    content: bytes
    content_type: str
    size: int

class UploadResult:
    def __init__(self, filename: str, success: bool, url: str = None, error: str = None):
        self.filename = filename
        self.success = success
        self.url = url
        self.error = error
        
    def to_dict(self):
        return {
            "filename": self.filename,
            "success": self.success,
            "url": self.url,
            "error": self.error
        }

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

async def upload_single_file(user_id: str, group_id: str, file_data: FileData) -> UploadResult:
    """Upload a single file to Firebase Storage"""
    async with upload_semaphore:
        try:
            if file_data.size == 0:
                return UploadResult(file_data.filename, False, error="File is empty or couldn't be read")
            
            start_time = time.time()
            unique_name = f"{uuid.uuid4()}_{file_data.filename}"
            firebase_path = f"{user_id}/{group_id}/image/{unique_name}"
            
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
            
            return UploadResult(file_data.filename, True, public_url)
            
        except Exception as e:
            logger.error(f"Upload failed for {file_data.filename}: {str(e)}")
            return UploadResult(file_data.filename, False, error=str(e))

@router.post("/upload/")
async def upload_images(
    user_id: str = Form(...),
    group_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Main upload endpoint with fixed file handling"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    # Validate file count
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Too many files. Maximum 50 files per request")
    
    start_time = time.time()
    logger.info(f"Starting upload of {len(files)} files for user {user_id}, group {group_id}")
    
    try:
        # Step 1: Read all files sequentially (this solves the file closure issue)
        logger.info("Reading files...")
        file_data_list = await read_files_sequentially(files)
        
        # Step 2: Validate file sizes after reading
        max_file_size = 10 * 1024 * 1024  # 10MB
        for file_data in file_data_list:
            if file_data.size > max_file_size:
                raise HTTPException(
                    status_code=400, 
                    detail=f"File {file_data.filename} is too large. Maximum size is 10MB"
                )
        
        # Step 3: Upload all files concurrently
        logger.info("Starting concurrent uploads...")
        upload_tasks = [
            upload_single_file(user_id, group_id, file_data) 
            for file_data in file_data_list
        ]
        
        results = await asyncio.gather(*upload_tasks, return_exceptions=True)
        
        # Handle any unexpected exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(
                    UploadResult(file_data_list[i].filename, False, error=str(result))
                )
            else:
                processed_results.append(result)
        
        # Gather statistics
        successful_uploads = sum(1 for r in processed_results if r.success)
        failed_uploads = len(processed_results) - successful_uploads
        total_time = time.time() - start_time
        
        logger.info(
            f"Upload completed: {successful_uploads} successful, {failed_uploads} failed "
            f"in {total_time:.2f}s"
        )
        
        return {
            "message": f"Processed {len(files)} files",
            "successful_uploads": successful_uploads,
            "failed_uploads": failed_uploads,
            "processing_time": f"{total_time:.2f}s",
            "results": [r.to_dict() for r in processed_results]
        }
        
    except Exception as e:
        logger.error(f"Batch upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/upload/background/")
async def upload_images_background(
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    group_id: str = Form(...),
    files: List[UploadFile] = File(...),
    webhook_url: Optional[str] = Form(None)
):
    """Upload files in background with fixed file handling"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    print("working")
    upload_id = str(uuid.uuid4())
    
    # Read files immediately in the request context
    try:
        file_data_list = await read_files_sequentially(files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read files: {str(e)}")
    
    async def background_upload():
        try:
            # Upload using pre-read file data
            upload_tasks = [
                upload_single_file(user_id, group_id, file_data) 
                for file_data in file_data_list
            ]
            
            results = await asyncio.gather(*upload_tasks, return_exceptions=True)
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append(
                        UploadResult(file_data_list[i].filename, False, error=str(result))
                    )
                else:
                    processed_results.append(result)
            
            successful_uploads = sum(1 for r in processed_results if r.success)
            total_files = len(processed_results)
            
            logger.info(f"Background upload {upload_id} completed: {successful_uploads}/{total_files} successful")
            
            # Optional webhook notification
            if webhook_url:
                import httpx
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(webhook_url, json={
                            "upload_id": upload_id,
                            "status": "completed",
                            "successful_uploads": successful_uploads,
                            "total_files": total_files,
                            "results": [r.to_dict() for r in processed_results]
                        })
                        logger.info(f"Webhook notification sent for upload {upload_id}")
                except Exception as webhook_error:
                    logger.error(f"Webhook notification failed for upload {upload_id}: {str(webhook_error)}")
                    
        except Exception as e:
            logger.error(f"Background upload {upload_id} failed: {str(e)}")
            
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
    return {
        "status": "healthy",
        "available_upload_slots": upload_semaphore._value,
        "max_concurrent_uploads": 20
    }