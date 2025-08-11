"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ImagesList() {
  const { person_id } = useParams();
  const [images, setImages] = useState<{ id: string; img_path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!person_id) return;

    const fetchImages = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/persons/${person_id}`);
        if (!res.ok) throw new Error("Failed to fetch images");

        const data = await res.json();
        setImages(data.images || []);
      } catch (err) {
        console.error("Error fetching images:", err);
        setError("Could not load images.");
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [person_id]);

  if (loading) return <p>Loading images...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Images for Person {person_id}</h2>
      {images.length === 0 ? (
        <p>No images found.</p>
      ) : (
        <div className="flex items-center justify-center max-w-[95vw] flex-wrap">
          {images.map((img) => (
            <img
              key={img.id}
              src={img.img_path} // Already a full data URL
              alt={`Person ${person_id}`}
              className="min-w-[300px] w-[300px] h-auto rounded-lg shadow"
            />
          ))}
        </div>
      )}
    </div>
  );
}
