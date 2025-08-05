'use client';

import { storage } from '@/lib/firebaseClient';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useState, useRef, useEffect } from 'react';
import pLimit from 'p-limit';
import { useUser } from '@/context/UserContext';

interface ImageMeta {
    id: string;
    location: string;
    filename: string;
    size: number;
    uploaded_at: string;
}

interface Props {
    userId: string;
    groupId: string;
}

export default function ImageUploader() {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filesMeta, setFilesMeta] = useState<ImageMeta[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadedCount, setUploadedCount] = useState(0);
    const uploadCounter = useRef(0);
    const cancelRef = useRef(false);
    const { userId, groupId } = useUser()

    useEffect(() => {
        console.log("user id", userId)
        console.log("GROUP id", userId)
    }), [userId, groupId]



    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const validFiles = Array.from(files).filter((file) =>
            file.type.startsWith('image/')
        );
        setSelectedFiles(validFiles);
        setFilesMeta([]);
        setUploadedCount(0);
        cancelRef.current = false;
    };

    const updateProgress = () => {
        uploadCounter.current += 1;
        if (uploadCounter.current % 5 === 0 || uploadCounter.current === selectedFiles.length) {
            setUploadedCount(uploadCounter.current);
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            alert('Please select images first.');
            return;
        }

        setUploading(true);
        const limit = pLimit(20);
        const results: ImageMeta[] = [];

        const uploadTasks = selectedFiles.map((file) =>
            limit(async () => {
                if (cancelRef.current) return null;

                try {
                    const uuid = uuidv4();
                    const timestamp = new Date().toISOString();
                    const filePath = `${userId}_${groupId}_${uuid}_${file.name}`;
                    const fileRef = ref(storage, filePath);

                    const uploadTask = await uploadBytesResumable(fileRef, file);
                    const downloadUrl = await getDownloadURL(uploadTask.ref);

                    const meta: ImageMeta = {
                        id: uuid,
                        location: downloadUrl,
                        filename: file.name,
                        size: file.size,
                        uploaded_at: timestamp,
                    };

                    updateProgress();
                    return meta;
                } catch (error) {
                    console.error(`Upload failed for ${file.name}:`, error);
                    return null; // Skip this file
                }
            })
        );

        try {
            const uploadedAll = await Promise.all(uploadTasks);
            const filtered = uploadedAll.filter((m): m is ImageMeta => m !== null);

            setFilesMeta(filtered);

            // Send metadata in chunks of 20
            const chunkSize = 20;
            for (let i = 0; i < filtered.length; i += chunkSize) {
                const chunk = filtered.slice(i, i + chunkSize);
                try {
                    const res = await fetch('/api/update-image-upload-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, groupId, images: chunk }),
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error('Failed to save metadata chunk:', errorText);
                    } else {
                        const data = await res.json();
                        console.log('Metadata chunk saved:', data);
                    }
                } catch (error) {
                    console.error('Error sending metadata:', error);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Some uploads may have failed.');
        }

        setUploading(false);
    };

    const handleCancel = () => {
        cancelRef.current = true;
        setUploading(false);
    };

    return (
        <div className="flex flex-col gap-4 max-w-md mx-auto mt-8">
            <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
            />
            <button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
                {uploading ? 'Uploading...' : 'Upload Images'}
            </button>

            {uploading && (
                <>
                    <progress
                        value={uploadedCount}
                        max={selectedFiles.length}
                        className="w-full h-2"
                    />
                    <p className="text-sm text-gray-600">
                        Uploaded: {uploadedCount} / {selectedFiles.length}
                    </p>
                    <button
                        onClick={handleCancel}
                        className="text-red-600 underline text-sm"
                    >
                        Cancel Upload
                    </button>
                </>
            )}
        </div>
    );
}
