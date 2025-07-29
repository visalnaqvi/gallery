"use client";

import React, { useState } from "react";
import api from "../../services/api";

const UploadComponent: React.FC = () => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<number>(0);

    const BATCH_SIZE = 10;
    const MAX_CONCURRENCY = 5;

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files = Array.from(event.target.files);

        if (files.length === 0) {
            alert("Please select images.");
            return;
        }

        setUploading(true);
        setProgress(0);

        // Prepare batches
        const batches: File[][] = [];
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            batches.push(files.slice(i, i + BATCH_SIZE));
        }

        let completed = 0;
        const total = files.length;

        const uploadBatch = async (batch: File[]) => {
            const formData = new FormData();
            formData.append("user_id", "abcdef"); // Replace with dynamic value
            formData.append("group_id", "67890"); // Replace with dynamic value
            batch.forEach((file) => formData.append("files", file));

            await api.post("/images/upload/background/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            completed += batch.length;
            setProgress(Math.round((completed / total) * 100));
        };

        // Process batches with limited concurrency
        const queue: Promise<void>[] = [];
        for (const batch of batches) {
            const promise = uploadBatch(batch);
            queue.push(promise);

            if (queue.length >= MAX_CONCURRENCY) {
                await Promise.race(queue);
                queue.splice(queue.findIndex((p) => p === promise), 1);
            }
        }
        await Promise.all(queue);

        alert("All images uploaded!");
        setUploading(false);
        setProgress(100);
    };

    return (
        <div className="p-4 border rounded-lg shadow-md w-full max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4">Upload Large Image Sets</h2>
            <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="mb-4"
            />
            {uploading && <p>Uploading... {progress}%</p>}
        </div>
    );
};

export default UploadComponent;
