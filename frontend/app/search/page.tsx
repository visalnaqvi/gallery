"use client";

import React, { useState } from "react";

interface ImageData {
  id: string;
  image_base64: string;
}

export default function FaceSearch() {
  const [faceId, setFaceId] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!faceId.trim()) {
      setError("Please enter a face ID.");
      return;
    }
    setLoading(true);
    setError(null);
    setPersonId(null);
    setImages([]);

    try {
      const res = await fetch(`/api/search-face?face_id=${encodeURIComponent(faceId)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch");
      }
      const data = await res.json();

      setPersonId(data.person_id);
      setImages(data.images);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h1>Search Images by Face ID</h1>
      <input
        type="text"
        value={faceId}
        onChange={(e) => setFaceId(e.target.value)}
        placeholder="Enter face ID"
        style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
      />
      <button onClick={handleSearch} disabled={loading} style={{ padding: "8px 16px" }}>
        {loading ? "Searching..." : "Search"}
      </button>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

      {personId && (
        <div style={{ marginTop: 20 }}>
          <h2>Person ID: {personId}</h2>
          {images.length === 0 ? (
            <p>No images found for this person.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {images.map((img) => (
                <img
                  key={img.id}
                  src={`data:image/jpeg;base64,${img.image_base64}`}
                  alt={`Image ${img.id}`}
                  style={{ width: 150, height: 150, objectFit: "cover", borderRadius: 8 }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
