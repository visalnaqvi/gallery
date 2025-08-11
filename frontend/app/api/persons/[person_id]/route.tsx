import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE,
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ person_id: string }> }
) {
  const { person_id } = await context.params;

  try {
    const client = await pool.connect();

    // Get all image_ids for this person
    const facesRes = await client.query(
      `SELECT image_id FROM faces WHERE person_id = $1`,
      [person_id]
    );
    const imageIds = facesRes.rows.map((row) => row.image_id);

    let images: { id: string; img_path: string }[] = [];

    if (imageIds.length > 0) {
      const imgRes = await client.query(
        `SELECT id, image_byte FROM images WHERE id = ANY($1::uuid[])`,
        [imageIds]
      );

      images = imgRes.rows.map((row) => ({
        id: row.id,
        img_path: `data:image/jpeg;base64,${Buffer.from(
          row.image_byte
        ).toString("base64")}`,
      }));
    }

    client.release();

    return NextResponse.json({ person_id, images }, { status: 200 });
  } catch (err) {
    console.error("Error fetching images:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
