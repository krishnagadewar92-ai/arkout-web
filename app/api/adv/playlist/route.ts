import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Advertisement playlist is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { blobs } = await list({ prefix: "arkout-ads/", limit: 100, token });
    const ads = blobs
      .map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType,
        uploadedAt: blob.uploadedAt.toISOString(),
      }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return NextResponse.json(
      { ads, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not retrieve the advertisement playlist." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
