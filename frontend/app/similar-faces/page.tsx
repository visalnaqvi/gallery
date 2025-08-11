"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface ImageData {
  image_id: string;
  image_byte: string; // base64 string
}

interface SimilarFace {
  face_id: string;
  face_thumb_bytes: string; // base64 string
  similar_faces_data: {
    similar_person_id: string;
    images: ImageData[];
  }[];
}

export default function SimilarFacesList() {
  const [faces, setFaces] = useState<SimilarFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const base64ToDataUrl = (base64str: string) =>
    base64str ? `data:image/jpeg;base64,${base64str}` : "";

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/similar_persons");
        if (!res.ok) throw new Error("Failed to fetch data");
        const json = await res.json();
        setFaces(json.data || []);
      } catch (err) {
        console.error(err);
        setError("Could not load similar faces");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="space-y-8 p-4">
      {faces.map((face) => (
        <div key={face.face_id} className="border p-4 rounded-lg shadow">
          {/* Main face + thumbnail */}
          <div className="flex items-center space-x-4">
            {face.face_thumb_bytes ? (
              <img
                src={base64ToDataUrl(face.face_thumb_bytes)}
                alt={face.face_id}
                className="w-20 h-20 object-cover rounded-full border"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500">
                No Image
              </div>
            )}
            <span className="font-bold break-words">{face.face_id}</span>
          </div>

          {/* Similar persons */}
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Similar Persons:</h3>
            <div className="flex flex-wrap gap-4">
              {face.similar_faces_data.map((sim) => (
                <Link
                  href={`/persons/${sim.similar_person_id}`}
                  key={sim.similar_person_id}
                  className="flex flex-col items-center text-sm hover:underline"
                >
                  {sim.images && sim.images.length > 0 && sim.images[0].image_byte ? (
                    <img
                      src={base64ToDataUrl(sim.images[0].image_byte)}
                      alt={sim.similar_person_id}
                      className="w-16 h-16 object-cover rounded-full border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500">
                      No Image
                    </div>
                  )}
                  <span>{sim.similar_person_id}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
