from fastapi import APIRouter, UploadFile, HTTPException
from config.firebase_config import bucket, db
import uuid

router = APIRouter()

@router.post("/upload/")
async def upload_image(file: UploadFile):
    try:
        print(f"Uploading image...")
        filename = f"{uuid.uuid4()}_{file.filename}"

        print(f"Generated filename: {filename}")
        blob = bucket.blob(filename)
        blob.upload_from_file(file.file, content_type=file.content_type)
        blob.make_public()  # Optional: make file public

        print("Uploaded to Firebase Storage")

        # Save metadata in Firestore
        doc_ref = db.collection("images").document()
        doc_ref.set({
            "filename": filename,
            "url": blob.public_url
        })

        print("Metadata saved in Firestore")

        return {"message": "Uploaded successfully", "url": blob.public_url}
    
    except Exception as e:
        print(f"❌ Error during upload: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
