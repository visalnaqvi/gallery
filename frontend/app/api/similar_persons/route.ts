import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET() {
  try {
    const client = await pool.connect();

    const query = `
      SELECT 
        main_person.person_id,
        main_person.face_thumb_bytes as thumbnail,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'sim_person_id', sf.similar_person_id,
            'thumb_img_byte', similar_person.face_thumb_bytes
          )
        ) as sim_faces
      FROM (
        -- Get best thumbnail for each main person
        SELECT DISTINCT
          person_id,
          FIRST_VALUE(face_thumb_bytes) OVER (
            PARTITION BY person_id 
            ORDER BY quality_score DESC NULLS LAST, id
          ) as face_thumb_bytes
        FROM faces
        WHERE person_id IN (SELECT DISTINCT person_id FROM similar_faces)
          AND face_thumb_bytes IS NOT NULL
      ) main_person
      JOIN similar_faces sf ON sf.person_id = main_person.person_id
      JOIN (
        -- Get best thumbnail for each similar person
        SELECT DISTINCT
          person_id,
          FIRST_VALUE(face_thumb_bytes) OVER (
            PARTITION BY person_id 
            ORDER BY quality_score DESC NULLS LAST, id
          ) as face_thumb_bytes
        FROM faces
        WHERE face_thumb_bytes IS NOT NULL
      ) similar_person ON similar_person.person_id = sf.similar_person_id
      GROUP BY main_person.person_id, main_person.face_thumb_bytes
      ORDER BY main_person.person_id;
    `;

    const result = await client.query(query);
    client.release();

    // Define types for better TypeScript support
    interface SimFace {
      sim_person_id: string;
      thumb_img_byte: Buffer | null;
    }

    interface QueryRow {
      person_id: string;
      thumbnail: Buffer | null;
      sim_faces: SimFace[];
    }

    // Format the response according to desired structure
    const formattedData = result.rows.map((row: QueryRow) => ({
      person_id: row.person_id,
      thumbnail: row.thumbnail 
        ? Buffer.from(row.thumbnail).toString("base64")
        : "",
      sim_faces: (row.sim_faces || []).map((simFace: SimFace) => ({
        sim_person_id: simFace.sim_person_id,
        thumb_img_byte: simFace.thumb_img_byte 
          ? Buffer.from(simFace.thumb_img_byte).toString("base64")
          : ""
      }))
    }));

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error("Error fetching similar faces:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}