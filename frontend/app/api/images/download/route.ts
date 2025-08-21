// /app/api/images/signed-download-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/firebaseAdmin"; // ✅ import singleton

export async function POST(request: NextRequest) {
  const { filename } = await request.json();

  try {
    const file = storage.bucket().file(filename);

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      responseDisposition: `attachment; filename="${filename}"`,
      responseType: "application/octet-stream",
    });

    return NextResponse.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
