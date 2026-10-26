import { del, list, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isSameAdminOrigin, isValidAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "arkout-ads/";
const APPROVED_PREFIX = "arkout-ads/approved/";
const EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif", "mp4", "m4v", "mov", "webm"]);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function authorized(request: NextRequest) {
  return isValidAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
function safeAssetPath(pathname: string) {
  if (!pathname.startsWith(PREFIX) || pathname.includes("..") || pathname.includes("\\")) return false;
  if (pathname.startsWith(APPROVED_PREFIX)) return false;
  const name = pathname.slice(PREFIX.length);
  if (name.includes("/") && !name.startsWith("pending/")) return false;
  const filename = name.startsWith("pending/") ? name.slice("pending/".length) : name;
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return /^\\d+-[0-9a-f-]{36}\\.[a-z0-9]+$/i.test(filename) && EXTENSIONS.has(extension);
}
function contentType(pathname: string) {
  const ext = pathname.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif", avif:"image/avif", heic:"image/heic", heif:"image/heif", mp4:"video/mp4", m4v:"video/x-m4v", mov:"video/quicktime", webm:"video/webm" };
  return ext ? types[ext] || "application/octet-stream" : "application/octet-stream";
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return json({ error: "Sign in to the admin panel to review advertisements." }, 401);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "Advertisement storage is not configured." }, 503);
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100, token });
    const ads = blobs.filter(blob => safeAssetPath(blob.pathname)).map(blob => ({
      pathname: blob.pathname, url: blob.url, size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(), contentType: contentType(blob.pathname),
    })).sort((a,b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return json({ ads });
  } catch {
    return json({ error: "Could not load pending advertisements." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameAdminOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!authorized(request)) return json({ error: "Sign in to the admin panel first." }, 401);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return json({ error: "Advertisement storage is not configured." }, 503);
  let body: { action?: unknown; pathname?: unknown };
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  if ((body.action !== "approve" && body.action !== "reject") || typeof body.pathname !== "string" || !safeAssetPath(body.pathname)) {
    return json({ error: "Invalid advertisement action or identifier." }, 400);
  }
  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 100, token });
    const source = blobs.find(blob => blob.pathname === body.pathname && safeAssetPath(blob.pathname));
    if (!source) return json({ error: "Pending advertisement not found." }, 404);
    if (body.action === "reject") {
      await del(source.pathname, { token });
      return json({ ok: true, action: "rejected" });
    }
    const response = await fetch(source.url, { cache: "no-store" });
    if (!response.ok) return json({ error: "Could not read the uploaded media for approval." }, 502);
    const filename = source.pathname.split("/").pop()!;
    const destination = APPROVED_PREFIX + filename;
    await put(destination, await response.arrayBuffer(), {
      access: "public", token, contentType: contentType(source.pathname), addRandomSuffix: false,
    });
    await del(source.pathname, { token });
    return json({ ok: true, action: "approved", pathname: destination });
  } catch {
    return json({ error: "The advertisement could not be processed. It remains unavailable for kiosk playback." }, 502);
  }
}
