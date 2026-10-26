import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "arkout-ads/approved/";
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
};

function typeFromPathname(pathname: string) {
  const extension = pathname.split(".").pop()?.toLowerCase() || "";
  return EXTENSION_TYPES[extension] || "";
}

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Advertisement playlist is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100, token });
    const ads = blobs
      .filter((blob) =>
        blob.pathname.startsWith(PREFIX) &&
        !blob.pathname.includes("..") &&
        !blob.pathname.includes("\\") &&
        Boolean(typeFromPathname(blob.pathname)),
      )
      .map((blob) => {
        const contentType = typeFromPathname(blob.pathname);
        return {
          url: blob.url,
          pathname: blob.pathname,
          contentType,
          type: contentType.startsWith("video/") ? "video" : "image",
          uploadedAt: blob.uploadedAt.toISOString(),
        };
      })
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return NextResponse.json(
      { ads, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=30, s-maxage=30",
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
