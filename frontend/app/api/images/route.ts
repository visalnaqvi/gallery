import { NextResponse } from "next/server";
import { Pool } from "pg";

// Create a connection pool (singleton)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("id");

    if (!imageId) {
      return NextResponse.json({ error: "Missing imageId query param" }, { status: 400 });
    }

    const query = `
      SELECT filename, json_meta_data, size
      FROM images
      WHERE id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [imageId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error("Error fetching image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
