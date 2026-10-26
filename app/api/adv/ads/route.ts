import { del, list } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { ADV_COOKIE_NAME, isSameOrigin, isValidAdvSession } from "@/lib/adv-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "arkout-ads/";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
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
  return EXTENSION_TYPES[extension] || "application/octet-stream";
}

function supportedPathname(pathname: string) {
  if (!pathname.startsWith(PREFIX) || pathname.includes("..") || pathname.includes("\\")) return false;
  const filename = pathname.slice(PREFIX.length);
  return /^(?:pending\/)?\d+-[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif|avif|heic|heif|mp4|m4v|mov|webm)$/i.test(filename);
}

function isSupportedBlobPath(pathname: string) {
  return pathname.startsWith(PREFIX) && !pathname.includes("..") && !pathname.includes("\\") &&
    typeFromPathname(pathname) !== "application/octet-stream";
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authorized(request: NextRequest) {
  return isValidAdvSession(request.cookies.get(ADV_COOKIE_NAME)?.value);
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function getBlobs() {
  const token = blobToken();
  if (!token) throw new Error("BLOB_NOT_CONFIGURED");
  const result = await list({ prefix: PREFIX, limit: 100, token });
  return result.blobs.filter((blob) => isSupportedBlobPath(blob.pathname));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return json({ error: "Sign in to manage advertisements." }, 401);
  if (!blobToken()) return json({ error: "Advertisement storage is not configured yet." }, 503);

  try {
    const blobs = await getBlobs();
    const ads = blobs
      .map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt.toISOString(),
        contentType: typeFromPathname(blob.pathname),
      }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return json({ ads });
  } catch {
    return json({ error: "Could not load advertisements from storage." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!blobToken()) return json({ error: "Advertisement storage is not configured yet." }, 503);

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: "Invalid upload request." }, 400);
  }

  // Vercel Blob calls this same route after upload completion. handleUpload verifies
  // that callback; browser token generation still requires same-origin + a valid session.
  const isBlobCompletion = (body as { type?: string }).type === "blob.upload-completed";
  if (!isBlobCompletion) {
    if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
    if (!authorized(request)) return json({ error: "Sign in to upload advertisements." }, 401);
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!supportedPathname(pathname)) throw new Error("Unsupported advertisement file name.");
        const contentType = typeFromPathname(pathname);
        if (contentType === "application/octet-stream") throw new Error("Unsupported advertisement format.");
        return {
          allowedContentTypes: [contentType],
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: false,
          validUntil: Date.now() + 15 * 60 * 1000,
          tokenPayload: JSON.stringify({ prefix: PREFIX }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        if (!isSupportedBlobPath(blob.pathname)) throw new Error("Unsupported advertisement upload.");
      },
    });
    return json(result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return json({ error: message === "Unsupported advertisement file name." ||
      message === "Unsupported advertisement format."
      ? message
      : "Upload failed. Check the selected media format and try again." }, 400);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!authorized(request)) return json({ error: "Sign in to delete advertisements." }, 401);
  if (!blobToken()) return json({ error: "Advertisement storage is not configured yet." }, 503);

  const pathname = request.nextUrl.searchParams.get("pathname") || "";
  if (!isSupportedBlobPath(pathname)) {
    return json({ error: "Invalid advertisement identifier." }, 400);
  }

  try {
    const blobs = await getBlobs();
    if (!blobs.some((blob) => blob.pathname === pathname)) {
      return json({ error: "Advertisement not found." }, 404);
    }
    await del(pathname, { token: blobToken() });
    return json({ ok: true });
  } catch {
    return json({ error: "Could not delete the advertisement." }, 502);
  }
}
