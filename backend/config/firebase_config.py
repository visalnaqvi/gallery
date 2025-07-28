import firebase_admin
from firebase_admin import credentials, firestore, storage

cred = credentials.Certificate("config/firebase-key.json")

firebase_admin.initialize_app(cred, {
    'storageBucket': 'gallery-585ee.firebasestorage.app' 
})


db = firestore.client()
bucket = storage.bucket()
