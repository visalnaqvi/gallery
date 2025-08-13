import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET(req: NextRequest) {
  try {
    const client = await pool.connect();

    // Query: get distinct person_id with any one thumb_byte
    const query = `
    SELECT DISTINCT ON (person_id) person_id, face_thumb_bytes
FROM faces
WHERE person_id IS NOT NULL AND face_thumb_bytes IS NOT NULL
ORDER BY person_id, quality_score DESC NULLS LAST
    `;
    //  const query = `
    //   SELECT DISTINCT id as person_id, face_thumb_bytes
    //   FROM persons
    //   WHERE face_thumb_bytes is not null
    `;
    //  const query = `
    //   SELECT 'abc' as person_id, face_thumb_bytes
    //   FROM faces
    //   WHERE face_thumb_bytes is not null
    // `;
    const result = await client.query(query);

    client.release();

    // Convert Buffer -> base64 string
    const formattedRows = result.rows.map((row) => ({
      person_id: row.person_id,
      face_thumb_bytes: row.face_thumb_bytes
        ? Buffer.from(row.face_thumb_bytes).toString("base64")
        : "",
    }));

    return NextResponse.json(formattedRows, { status: 200 });
  } catch (err) {
    console.error("Error fetching person IDs:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
