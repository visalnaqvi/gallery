"use client";

import React, { useState } from "react";
import api from "../services/api";

const UploadComponent: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const files = Array.from(event.target.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) {
      alert("Please select only image files.");
      return;
    }

    // Directly set the original files (no compression)
    setSelectedFiles(files);
    alert(`Selected ${files.length} images!`);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("file", file);
    });

    try {
      setUploading(true);
      await api.post("/images/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });
      alert("Images uploaded successfully!");
    } catch (error) {
      console.error("Upload Error:", error);
      alert("Upload failed!");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="text-lg font-semibold mb-4">Upload Images</h2>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="mb-4"
      />

      {selectedFiles.length > 0 && <p>{selectedFiles.length} images ready</p>}
      {uploading && <p>Uploading... {progress}%</p>}

      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || uploading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
};

export default UploadComponent;
