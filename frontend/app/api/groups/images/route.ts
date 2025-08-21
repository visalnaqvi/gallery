import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { storage } from "@/lib/firebaseAdmin"; 

// setup postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE, // railway, supabase, etc.
});

// helper to refresh signed url
async function refreshSignedUrl(imgId: string) {
  try {
    const file = storage.bucket().file("compressed_" + imgId);

    // signed url valid for 8h
    const [newSignedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 8 * 60 * 60 * 1000,
    });

    // expiry time 10 min before actual
    const expireTime = new Date(Date.now() + (8 * 60 - 10) * 60 * 1000);

    // run DB update in background (don’t await)
    pool.query(
      `UPDATE images 
       SET signed_url = $1, expire_time = $2 
       WHERE id = $3`,
      [newSignedUrl, expireTime, imgId]
    ).then(() => {
      console.log(`✅ Background DB update done for ${imgId}`);
    }).catch(err => {
      console.error(`❌ Failed background DB update for ${imgId}:`, err);
    });

    return { signedUrl: newSignedUrl, expireTime };
  } catch (err) {
    console.error(`❌ Failed to refresh signed URL for ${imgId}:`, err);
    return null;
  }
}

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
        `SELECT id, filename, thumb_byte, uploaded_at, size, date_taken, signed_url, expire_time 
         FROM images 
         WHERE group_id = $1 
         ORDER BY uploaded_at DESC
         LIMIT $2 OFFSET $3`,
        [groupId, limit + 1, offset] // fetch one extra to check hasMore
      );

      const rows = result.rows;
      const hasMore = rows.length > limit;
      const imagesFromDB = hasMore ? rows.slice(0, limit) : rows;

      const refreshTasks: Promise<any>[] = [];

      const images = await Promise.all(
        imagesFromDB.map(async (img) => {
          let signedUrl = img.signed_url;
          let expireTime = img.expire_time ? new Date(img.expire_time) : null;

          // if missing or expired, refresh immediately (await so response has URL)
          if (!signedUrl || !expireTime || expireTime < new Date()) {
            // generate fresh signed url immediately
            const refreshed = await refreshSignedUrl(img.id); // now does DB update in background
            if (refreshed) {
              signedUrl = refreshed.signedUrl;
              expireTime = refreshed.expireTime;
            }
          } else {
            // if close to expiry, refresh in background (don’t block response)
            const timeLeft = expireTime.getTime() - Date.now();
            if (timeLeft < 15 * 60 * 1000) {
              refreshSignedUrl(img.id); // fire and forget
            }
          }

          return {
            id: img.id,
            compressed_location: `data:image/jpeg;base64,${Buffer.from(
              img.thumb_byte
            ).toString("base64")}`,
            filename: img.filename,
            uploaded_at: img.uploaded_at,
            size: img.size,
            date_taken: img.date_taken,
            original_location: signedUrl,
            expire_time: expireTime,
          };
        })
      );

      // run background refreshes (don’t block API)
      Promise.all(refreshTasks).then(() =>
        console.log(`✅ Background refresh done for ${refreshTasks.length} URLs`)
      );

      return NextResponse.json({ images, hasMore });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("❌ Error in GET /api/images:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
