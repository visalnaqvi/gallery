import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET() {
  try {
    const client = await pool.connect();

    const query = `
      WITH similar_faces_grouped AS (
  SELECT 
    face_id::uuid, 
    ARRAY_AGG(similar_person_id::uuid) AS similar_ids
  FROM similar_faces
  GROUP BY face_id
)
SELECT 
  s.face_id,
  f.face_thumb_bytes,
  s.similar_ids,
  ARRAY(
    SELECT json_build_object(
      'similar_person_id', sp_id,
      'images', (
        SELECT ARRAY_AGG(
          json_build_object(
            'image_id', face.image_id,
            'image_byte', encode(img.image_byte, 'base64')
          )
        )
        FROM faces face
        JOIN images img ON face.image_id = img.id
        WHERE face.person_id = sp_id
      )
    )
    FROM unnest(s.similar_ids) AS sp_id
  ) AS similar_faces_data
FROM similar_faces_grouped s
JOIN faces f ON f.id = s.face_id;
    `;

    const result = await client.query(query);
    client.release();

    // Convert Buffer to base64 string for all images & face thumbnails
    const formattedRows = result.rows.map((row) => ({
      face_id: row.face_id,
      face_thumb_bytes: row.face_thumb_bytes
        ? Buffer.from(row.face_thumb_bytes).toString("base64")
        : "",
      similar_faces_data: (row.similar_faces_data || []).map((sim: any) => ({
        similar_person_id: sim.similar_person_id,
        images: (sim.images || []).map((img: any) => ({
          image_id: img.image_id,
          image_byte: img.image_byte
            ? Buffer.from(img.image_byte).toString("base64")
            : "",
        })),
      })),
    }));

    return NextResponse.json({ data: formattedRows });
  } catch (error) {
    console.error("Error fetching similar faces:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
