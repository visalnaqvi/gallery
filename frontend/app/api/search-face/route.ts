// app/api/search-face/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const faceId = searchParams.get("face_id");

  if (!faceId) {
    return NextResponse.json({ error: "Missing face_id parameter" }, { status: 400 });
  }

  try {
    const client = await pool.connect();

    // 1. Get person_id for the given face_id
    const personRes = await client.query(
      "SELECT person_id FROM faces WHERE id = $1",
      [faceId]
    );

    if (personRes.rowCount === 0 || !personRes.rows[0].person_id) {
      client.release();
      return NextResponse.json({ error: "Face or person not found" }, { status: 404 });
    }

    const personId = personRes.rows[0].person_id;

    // 2. Get all image_ids for that person_id from faces table
    const imagesIdRes = await client.query(
      "SELECT image_id FROM faces WHERE person_id = $1",
      [personId]
    );

    const imageIds = imagesIdRes.rows.map((r) => r.image_id);

    if (imageIds.length === 0) {
      client.release();
      return NextResponse.json({ person_id: personId, images: [] }, { status: 200 });
    }

    // 3. Query images table for image_byte by image_ids
    const imagesRes = await client.query(
      `SELECT id, encode(image_byte, 'base64') AS image_base64 FROM images WHERE id = ANY($1::uuid[])`,
      [imageIds]
    );

    client.release();

    // Format response
    const images = imagesRes.rows.map((row) => ({
      id: row.id,
      image_base64: row.image_base64,
    }));

    return NextResponse.json({ person_id: personId, images }, { status: 200 });
  } catch (err) {
    console.error("Error in search-face API:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
