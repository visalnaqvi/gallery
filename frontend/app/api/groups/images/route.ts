import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

// setup postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE, // railway, supabase, etc.
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const page = parseInt(searchParams.get("page") || "0", 10);
    const limit = 10;
    const offset = page * limit;

    if (!groupId) {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT location FROM images 
         WHERE group_id = $1 
         ORDER BY uploaded_at DESC
         LIMIT $2 OFFSET $3`,
        [groupId, limit + 1, offset] // fetch one extra to check hasMore
      );

      const rows = result.rows.map((r) => r.location);
      const hasMore = rows.length > limit;
      const images = hasMore ? rows.slice(0, limit) : rows;

      return NextResponse.json({ images, hasMore });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
