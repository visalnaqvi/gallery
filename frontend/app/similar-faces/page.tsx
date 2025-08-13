"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface SimFace {
  sim_person_id: string;
  thumb_img_byte: string; // base64 string
}

interface PersonData {
  person_id: string;
  thumbnail: string; // base64 string
  sim_faces: SimFace[];
}

export default function SimilarFacesList() {
  const [persons, setPersons] = useState<PersonData[]>([]);
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
        setPersons(json.data || []);
      } catch (err) {
        console.error(err);
        setError("Could not load similar faces");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
const merge = async (p_id: string, m_id: string) => {
  try {
    const response = await fetch("/api/merge_persons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merge_person_id: p_id,
        merge_into_person_id: m_id,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Merge failed: ${errorText}`);
    }

    const data = await response.json();
    console.log("Merge successful:", data);
    return data;
  } catch (error) {
    console.error("Error merging persons:", error);
    throw error;
  }
};
  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div className="space-y-8 p-4">
      <h1 className="text-2xl font-bold mb-6">Similar Persons</h1>

      {persons.length === 0 ? (
        <p className="text-gray-500">No similar persons found.</p>
      ) : (
        persons.map((person) => (
          <div key={person.person_id} className="border p-6 rounded-lg shadow-md bg-white">
            {/* Main person + thumbnail */}
            <div className="flex items-center space-x-4 mb-4">
              {person.thumbnail ? (
                <img
                  src={base64ToDataUrl(person.thumbnail)}
                  alt={`Person ${person.person_id}`}
                  className="w-24 h-24 object-cover rounded-full border-2 border-blue-200"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500 border-2 border-gray-300">
                  No Image
                </div>
              )}
              <div>
                <Link
                  href={`/persons/${person.person_id}`}
                  className="hover:underline"
                >
                  <h2 className="font-bold text-lg text-blue-600">
                    Person ID: {person.person_id}
                  </h2>
                </Link>
                <p className="text-sm text-gray-600">
                  {person.sim_faces.length} similar person{person.sim_faces.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {/* Similar persons */}
            {person.sim_faces.length > 0 ? (
              <div className="mt-4">
                <h3 className="font-semibold mb-3 text-gray-800">Similar Persons:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {person.sim_faces.map((simFace) => (
                    <div key={simFace.sim_person_id}><Link
                      href={`/persons/${simFace.sim_person_id}`}
                      
                      className="flex flex-col items-center text-sm hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    >
                      {simFace.thumb_img_byte ? (
                        <img
                          src={base64ToDataUrl(simFace.thumb_img_byte)}
                          alt={`Similar person ${simFace.sim_person_id}`}
                          className="w-16 h-16 object-cover rounded-full border border-gray-200 hover:border-blue-300 transition-colors"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500 border border-gray-300">
                          No Image
                        </div>
                      )}
                      <span className="mt-2 text-xs text-center break-words max-w-full text-blue-600 hover:text-blue-800">
                        {simFace.sim_person_id.length > 8
                          ? `${simFace.sim_person_id.substring(0, 8)}...`
                          : simFace.sim_person_id
                        }
                      </span>
                    </Link>
                    <button onClick={()=>{merge(person.person_id , simFace.sim_person_id)}}>Merge</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-sm">No similar persons found for this person.</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}