import { NextResponse } from "next/server";
import { piAdsBase, piAdsFetch } from "@/lib/pi-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
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

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const response = await piAdsFetch("/api/ads/manage");

    if (!response.ok) {
      return errorResponse("Advertisement playlist is temporarily unavailable.", 502);
    }

    const data = await response.json();
    const records = Array.isArray(data.ads) ? data.ads : [];
    const base = piAdsBase();

    const ads = records
      .filter((ad: { enabled?: boolean; approvalStatus?: string; filename?: string }) =>
        ad.enabled === true && ad.approvalStatus === "approved" &&
        typeof ad.filename === "string" &&
        /^[0-9a-f]{32}\.(jpg|jpeg|png|webp|gif|avif|heic|heif|mp4|m4v|mov|webm)$/i.test(ad.filename),
      )
      .map((ad: { filename: string; contentType?: string; uploadedAt?: string; title?: string }) => {
        const extension = ad.filename.split(".").pop()?.toLowerCase() || "";
        const contentType = TYPES[extension];

        return {
          url: `${base}/api/ads/media/${ad.filename}`,
          pathname: `arkout-ads/approved/${ad.filename}`,
          contentType,
          type: contentType.startsWith("video/") ? "video" : "image",
          uploadedAt: ad.uploadedAt || null,
          caption: typeof ad.title === "string" ? ad.title.slice(0, 100) : "Advertisement",
        };
      });

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
    return errorResponse("Could not connect to Pi advertisement storage.", 502);
  }
}
