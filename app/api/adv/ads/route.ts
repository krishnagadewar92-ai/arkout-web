import { del, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADV_COOKIE_NAME, isSameOrigin, isValidAdvSession } from "@/lib/adv-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "arkout-ads/";
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function typeFromPathname(pathname: string) {
  if (pathname.endsWith(".jpg")) return "image/jpeg";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
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
  return result.blobs;
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
  if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!authorized(request)) return json({ error: "Sign in to upload advertisements." }, 401);
  if (!blobToken()) return json({ error: "Advertisement storage is not configured yet." }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid upload request." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return json({ error: "Choose an image to upload." }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return json({ error: "Images must be 3 MB or smaller." }, 413);
  }
  const extension = TYPES[file.type];
  if (!extension) {
    return json({ error: "Use a JPG, PNG, or WebP image." }, 415);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const bytesMatchType =
    (file.type === "image/jpeg" && isJpeg) ||
    (file.type === "image/png" && isPng) ||
    (file.type === "image/webp" && isWebp);
  if (!bytesMatchType) {
    return json({ error: "The file contents do not match the selected image format." }, 415);
  }

  try {
    const pathname = `${PREFIX}${Date.now()}-${randomUUID()}.${extension}`;
    const blob = await put(pathname, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
      token: blobToken(),
    });
    return json({
      ad: {
        pathname: blob.pathname,
        url: blob.url,
        contentType: typeFromPathname(blob.pathname),
        uploadedAt: new Date().toISOString(),
        size: file.size,
      },
    }, 201);
  } catch {
    return json({ error: "Upload failed. Check the connected Blob store." }, 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!authorized(request)) return json({ error: "Sign in to delete advertisements." }, 401);
  if (!blobToken()) return json({ error: "Advertisement storage is not configured yet." }, 503);

  const pathname = request.nextUrl.searchParams.get("pathname") || "";
  if (!pathname.startsWith(PREFIX) || pathname.includes("..") || pathname.includes("\\")) {
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
