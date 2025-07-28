from fastapi import APIRouter, UploadFile, Form, File, HTTPException
from typing import List
from config.firebase_config import bucket, db
import uuid
import asyncio

router = APIRouter()

async def upload_to_firebase(user_id: str, group_id: str, file: UploadFile):
    try:
        unique_name = f"{uuid.uuid4()}_{file.filename}"
        firebase_path = f"{user_id}/{group_id}/image/{unique_name}"

        blob = bucket.blob(firebase_path)
        blob.upload_from_file(file.file, content_type=file.content_type)
        blob.make_public()

        doc_ref = db.collection("images").document()
        doc_ref.set({
            "user_id": user_id,
            "group_id": group_id,
            "filename": unique_name,
            "storage_path": firebase_path,
            "url": blob.public_url
        })

        return {"filename": unique_name, "url": blob.public_url}
    except Exception as e:
        return {"error": str(e), "filename": file.filename}

@router.post("/upload/")
async def upload_images(
    user_id: str = Form(...),
    group_id: str = Form(...),
    files: List[UploadFile] = File(...)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    tasks = [upload_to_firebase(user_id, group_id, file) for file in files]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return {"message": f"{len(files)} files processed", "results": results}
